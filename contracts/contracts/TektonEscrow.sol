// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TektonEscrow
 * @notice Trustless OTC trading desk on Bitcoin via MIDL Protocol.
 *         Supports BTC <-> ERC20 (Rune-backed) atomic swaps with
 *         on-chain reputation, platform fees, and anti-spam stakes.
 */
contract TektonEscrow is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // ─── Types ───────────────────────────────────────────────────────

    enum OfferStatus {
        Open,
        Settled,
        Cancelled,
        Expired
    }

    struct Offer {
        address maker;
        address makerToken;        // address(0) = native BTC
        uint256 makerAmount;
        address takerToken;        // address(0) = native BTC
        uint256 takerAmount;
        uint256 stake;             // Anti-spam stake in BTC (always native)
        uint256 expiry;
        uint256 cancelRequestedAt;
        address allowedTaker;      // 0x0 = public offer
        address taker;
        OfferStatus status;
    }

    struct TraderProfile {
        uint256 tradesCompleted;
        uint256 totalVolume;       // Cumulative volume in wei (BTC equivalent)
        uint256 offersCancelled;
        uint256 offersExpired;
        uint256 firstTradeAt;
    }

    // ─── State ───────────────────────────────────────────────────────

    uint256 public nextOfferId;
    mapping(uint256 => Offer) public offers;
    mapping(address => TraderProfile) public profiles;
    mapping(address => uint256[]) public userOfferIds;

    uint256 public minStake;
    uint256 public platformFeeBps;
    uint256 public constant MAX_FEE_BPS = 500;      // 5% hard cap
    uint256 public constant CANCEL_COOLDOWN = 30 minutes; // 30 min for regtest testing
    address public feeRecipient;
    uint256 public accumulatedFees;

    // ─── Events ──────────────────────────────────────────────────────

    event OfferCreated(
        uint256 indexed offerId,
        address indexed maker,
        address makerToken,
        uint256 makerAmount,
        address takerToken,
        uint256 takerAmount,
        uint256 stake,
        uint256 expiry,
        address allowedTaker
    );

    event OfferSettled(
        uint256 indexed offerId,
        address indexed taker,
        uint256 makerReceived,
        uint256 takerReceived,
        uint256 platformFee
    );

    event CancelRequested(uint256 indexed offerId, uint256 cancelableAfter);
    event CancelFinalized(uint256 indexed offerId);
    event OfferReclaimed(uint256 indexed offerId);
    event FeesWithdrawn(address indexed recipient, uint256 amount);
    event PlatformFeeUpdated(uint256 oldBps, uint256 newBps);
    event MinStakeUpdated(uint256 oldStake, uint256 newStake);
    event FeeRecipientUpdated(address oldRecipient, address newRecipient);

    uint256 public constant MIN_EXPIRY_DURATION = 1 hours;

    // ─── Constructor ─────────────────────────────────────────────────

    constructor(
        uint256 _minStake,
        uint256 _platformFeeBps,
        address _feeRecipient
    ) Ownable(msg.sender) {
        require(_platformFeeBps <= MAX_FEE_BPS, "Fee exceeds cap");
        require(_feeRecipient != address(0), "Invalid fee recipient");
        minStake = _minStake;
        platformFeeBps = _platformFeeBps;
        feeRecipient = _feeRecipient;
    }

    // ─── Core Functions ──────────────────────────────────────────────

    /**
     * @notice Create an OTC offer.
     * @param makerToken   Token to sell (address(0) = BTC)
     * @param makerAmount  Amount to sell
     * @param takerToken   Token wanted in return (address(0) = BTC)
     * @param takerAmount  Amount wanted
     * @param expiry       Unix timestamp when offer expires
     * @param allowedTaker If non-zero, only this address can accept (private offer)
     *
     * If makerToken is BTC: msg.value must be >= makerAmount + minStake
     * If makerToken is ERC20: msg.value must be >= minStake, and maker must approve contract first
     */
    function createOffer(
        address makerToken,
        uint256 makerAmount,
        address takerToken,
        uint256 takerAmount,
        uint256 expiry,
        address allowedTaker
    ) external payable nonReentrant {
        require(makerAmount > 0, "Maker amount is zero");
        require(takerAmount > 0, "Taker amount is zero");
        require(expiry > block.timestamp, "Expiry in the past");
        require(expiry >= block.timestamp + MIN_EXPIRY_DURATION, "Expiry too soon (min 1h)");
        require(makerToken != takerToken, "Cannot trade same token");

        uint256 stake = minStake;

        if (makerToken == address(0)) {
            // Maker is selling BTC — msg.value covers amount + stake
            require(msg.value >= makerAmount + stake, "Insufficient BTC sent");
            // Refund any excess BTC (R9-02)
            uint256 excess = msg.value - makerAmount - stake;
            if (excess > 0) {
                (bool ok, ) = msg.sender.call{value: excess}("");
                require(ok, "Excess refund failed");
            }
        } else {
            // Maker is selling ERC20 — msg.value covers stake only
            require(msg.value >= stake, "Insufficient stake");
            // Refund any excess BTC beyond stake (R9-02)
            uint256 excess = msg.value - stake;
            if (excess > 0) {
                (bool ok, ) = msg.sender.call{value: excess}("");
                require(ok, "Excess refund failed");
            }
            IERC20(makerToken).safeTransferFrom(msg.sender, address(this), makerAmount);
        }

        uint256 offerId = nextOfferId++;

        offers[offerId] = Offer({
            maker: msg.sender,
            makerToken: makerToken,
            makerAmount: makerAmount,
            takerToken: takerToken,
            takerAmount: takerAmount,
            stake: stake,
            expiry: expiry,
            cancelRequestedAt: 0,
            allowedTaker: allowedTaker,
            taker: address(0),
            status: OfferStatus.Open
        });

        userOfferIds[msg.sender].push(offerId);

        emit OfferCreated(
            offerId,
            msg.sender,
            makerToken,
            makerAmount,
            takerToken,
            takerAmount,
            stake,
            expiry,
            allowedTaker
        );
    }

    /**
     * @notice Accept an offer — atomic swap in one transaction.
     * @param offerId The offer to accept
     *
     * If takerToken is BTC: msg.value must be >= takerAmount
     * If takerToken is ERC20: taker must approve contract first
     */
    function acceptOffer(uint256 offerId) external payable nonReentrant {
        Offer storage offer = offers[offerId];

        require(offer.status == OfferStatus.Open, "Offer not open");
        require(block.timestamp < offer.expiry, "Offer expired");
        require(offer.maker != msg.sender, "Cannot accept own offer");
        require(
            offer.allowedTaker == address(0) || offer.allowedTaker == msg.sender,
            "Not allowed taker"
        );

        // Transfer taker's side in
        if (offer.takerToken == address(0)) {
            require(msg.value >= offer.takerAmount, "Insufficient BTC");
            // Refund any excess BTC (R9-02)
            uint256 excess = msg.value - offer.takerAmount;
            if (excess > 0) {
                (bool ok, ) = msg.sender.call{value: excess}("");
                require(ok, "Excess refund failed");
            }
        } else {
            IERC20(offer.takerToken).safeTransferFrom(
                msg.sender,
                address(this),
                offer.takerAmount
            );
        }

        // Calculate fees
        uint256 makerFee = (offer.takerAmount * platformFeeBps) / 10000;
        uint256 takerFee = (offer.makerAmount * platformFeeBps) / 10000;
        uint256 makerReceives = offer.takerAmount - makerFee;
        uint256 takerReceives = offer.makerAmount - takerFee;

        // ── Effects (state updates BEFORE external calls — CEI pattern) ──
        offer.taker = msg.sender;
        offer.status = OfferStatus.Settled;
        offer.cancelRequestedAt = 0;

        // Update reputation for both parties
        _recordTrade(offer.maker, offer.makerAmount);
        _recordTrade(msg.sender, offer.takerAmount);

        userOfferIds[msg.sender].push(offerId);

        // ── Interactions (external calls AFTER state updates) ──

        // Accumulate fees (in respective tokens)
        // For simplicity, we only accumulate BTC fees; ERC20 fees go directly to feeRecipient
        if (offer.takerToken == address(0)) {
            accumulatedFees += makerFee;
        } else if (makerFee > 0) {
            IERC20(offer.takerToken).safeTransfer(feeRecipient, makerFee);
        }

        if (offer.makerToken == address(0)) {
            accumulatedFees += takerFee;
        } else if (takerFee > 0) {
            IERC20(offer.makerToken).safeTransfer(feeRecipient, takerFee);
        }

        // Send maker their side (takerToken - fee)
        _transferOut(offer.takerToken, offer.maker, makerReceives);

        // Send taker their side (makerToken - fee)
        _transferOut(offer.makerToken, msg.sender, takerReceives);

        // Refund maker's stake
        if (offer.stake > 0) {
            (bool stakeOk, ) = offer.maker.call{value: offer.stake}("");
            require(stakeOk, "Stake refund failed");
        }

        emit OfferSettled(offerId, msg.sender, makerReceives, takerReceives, makerFee + takerFee);
    }

    /**
     * @notice Request cancellation of an open offer. Starts 5h cooldown.
     *         Takers can still accept during the cooldown (which voids the cancel).
     */
    function requestCancel(uint256 offerId) external {
        Offer storage offer = offers[offerId];
        require(offer.maker == msg.sender, "Not the maker");
        require(offer.status == OfferStatus.Open, "Offer not open");
        require(offer.cancelRequestedAt == 0, "Cancel already requested");

        offer.cancelRequestedAt = block.timestamp;

        emit CancelRequested(offerId, block.timestamp + CANCEL_COOLDOWN);
    }

    /**
     * @notice Finalize cancellation after the 5h cooldown has passed.
     */
    function finalizeCancel(uint256 offerId) external nonReentrant {
        Offer storage offer = offers[offerId];
        require(offer.maker == msg.sender, "Not the maker");
        require(offer.status == OfferStatus.Open, "Offer not open");
        require(offer.cancelRequestedAt > 0, "Cancel not requested");
        require(
            block.timestamp >= offer.cancelRequestedAt + CANCEL_COOLDOWN,
            "Cooldown not elapsed"
        );

        offer.status = OfferStatus.Cancelled;

        // Update reputation (before external calls — CEI pattern)
        profiles[offer.maker].offersCancelled++;

        // Refund maker's tokens
        _transferOut(offer.makerToken, offer.maker, offer.makerAmount);

        // Refund stake
        if (offer.stake > 0) {
            (bool ok, ) = offer.maker.call{value: offer.stake}("");
            require(ok, "Stake refund failed");
        }

        emit CancelFinalized(offerId);
    }

    /**
     * @notice Reclaim funds from an expired, unfilled offer.
     */
    function reclaimExpired(uint256 offerId) external nonReentrant {
        Offer storage offer = offers[offerId];
        require(offer.maker == msg.sender, "Not the maker");
        require(offer.status == OfferStatus.Open, "Offer not open");
        require(block.timestamp >= offer.expiry, "Not yet expired");

        offer.status = OfferStatus.Expired;

        // Update reputation (before external calls — CEI pattern)
        profiles[offer.maker].offersExpired++;

        // Refund maker's tokens
        _transferOut(offer.makerToken, offer.maker, offer.makerAmount);

        // Refund stake
        if (offer.stake > 0) {
            (bool ok, ) = offer.maker.call{value: offer.stake}("");
            require(ok, "Stake refund failed");
        }

        emit OfferReclaimed(offerId);
    }

    // ─── View Functions ──────────────────────────────────────────────

    function getOffer(uint256 offerId) external view returns (Offer memory) {
        return offers[offerId];
    }

    function getActiveOffers()
        external
        view
        returns (uint256[] memory ids, Offer[] memory activeOffers)
    {
        // Count active offers
        uint256 count = 0;
        for (uint256 i = 0; i < nextOfferId; i++) {
            if (
                offers[i].status == OfferStatus.Open &&
                block.timestamp < offers[i].expiry
            ) {
                count++;
            }
        }

        ids = new uint256[](count);
        activeOffers = new Offer[](count);
        uint256 idx = 0;

        for (uint256 i = 0; i < nextOfferId; i++) {
            if (
                offers[i].status == OfferStatus.Open &&
                block.timestamp < offers[i].expiry
            ) {
                ids[idx] = i;
                activeOffers[idx] = offers[i];
                idx++;
            }
        }
    }

    /**
     * @notice Paginated version of getActiveOffers.
     * @param offset Number of active offers to skip
     * @param limit  Maximum number of active offers to return
     */
    function getActiveOffersPaginated(uint256 offset, uint256 limit)
        external
        view
        returns (
            uint256[] memory ids,
            Offer[] memory activeOffers,
            uint256 totalActive
        )
    {
        // First pass: count total active offers
        totalActive = 0;
        for (uint256 i = 0; i < nextOfferId; i++) {
            if (
                offers[i].status == OfferStatus.Open &&
                block.timestamp < offers[i].expiry
            ) {
                totalActive++;
            }
        }

        // Calculate page size
        uint256 start = offset > totalActive ? totalActive : offset;
        uint256 remaining = totalActive - start;
        uint256 pageSize = remaining < limit ? remaining : limit;

        ids = new uint256[](pageSize);
        activeOffers = new Offer[](pageSize);
        uint256 skipped = 0;
        uint256 collected = 0;

        for (uint256 i = 0; i < nextOfferId && collected < pageSize; i++) {
            if (
                offers[i].status == OfferStatus.Open &&
                block.timestamp < offers[i].expiry
            ) {
                if (skipped < start) {
                    skipped++;
                } else {
                    ids[collected] = i;
                    activeOffers[collected] = offers[i];
                    collected++;
                }
            }
        }
    }

    function getUserOffers(address user)
        external
        view
        returns (uint256[] memory)
    {
        return userOfferIds[user];
    }

    function getProfile(address user)
        external
        view
        returns (TraderProfile memory)
    {
        return profiles[user];
    }

    /**
     * @notice Compute a 0-100 reliability score for a trader.
     *
     * Formula:
     *   completionRate = tradesCompleted / totalOffers (max 80 pts)
     *   ageBonus = min(daysSinceFirstTrade / 90, 1) * 10 (max 10 pts)
     *   volumeBonus = min(totalVolume / 10 BTC, 1) * 10 (max 10 pts)
     */
    function getReliabilityScore(address user) external view returns (uint256) {
        TraderProfile memory p = profiles[user];
        uint256 totalOffers = p.tradesCompleted +
            p.offersCancelled +
            p.offersExpired;

        if (totalOffers == 0) return 0;

        // Completion rate: 0–80 points
        uint256 completionPts = (p.tradesCompleted * 80) / totalOffers;

        // Age bonus: 0–10 points (capped at 90 days)
        uint256 agePts = 0;
        if (p.firstTradeAt > 0) {
            uint256 daysSince = (block.timestamp - p.firstTradeAt) / 1 days;
            agePts = daysSince >= 90 ? 10 : (daysSince * 10) / 90;
        }

        // Volume bonus: 0–10 points (capped at 10 BTC = 10e18 wei)
        uint256 volumeCap = 10 ether; // 10 BTC in wei
        uint256 volumePts = p.totalVolume >= volumeCap
            ? 10
            : (p.totalVolume * 10) / volumeCap;

        return completionPts + agePts + volumePts;
    }

    // ─── Admin Functions ─────────────────────────────────────────────

    function setMinStake(uint256 _minStake) external onlyOwner {
        emit MinStakeUpdated(minStake, _minStake);
        minStake = _minStake;
    }

    function setPlatformFee(uint256 _bps) external onlyOwner {
        require(_bps <= MAX_FEE_BPS, "Fee exceeds cap");
        emit PlatformFeeUpdated(platformFeeBps, _bps);
        platformFeeBps = _bps;
    }

    function setFeeRecipient(address _recipient) external onlyOwner {
        require(_recipient != address(0), "Invalid recipient");
        emit FeeRecipientUpdated(feeRecipient, _recipient);
        feeRecipient = _recipient;
    }

    function withdrawFees() external onlyOwner nonReentrant {
        uint256 amount = accumulatedFees;
        require(amount > 0, "No fees to withdraw");
        accumulatedFees = 0;
        (bool ok, ) = feeRecipient.call{value: amount}("");
        require(ok, "Fee withdrawal failed");
        emit FeesWithdrawn(feeRecipient, amount);
    }

    // ─── Internal Helpers ────────────────────────────────────────────

    function _transferOut(
        address token,
        address to,
        uint256 amount
    ) internal {
        if (amount == 0) return;
        if (token == address(0)) {
            (bool ok, ) = to.call{value: amount}("");
            require(ok, "BTC transfer failed");
        } else {
            IERC20(token).safeTransfer(to, amount);
        }
    }

    function _recordTrade(address trader, uint256 volume) internal {
        TraderProfile storage p = profiles[trader];
        p.tradesCompleted++;
        p.totalVolume += volume;
        if (p.firstTradeAt == 0) {
            p.firstTradeAt = block.timestamp;
        }
    }

    // Allow contract to receive BTC
    receive() external payable {}
}
