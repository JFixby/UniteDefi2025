const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Escrow Contract", function () {
  let escrow;
  let owner;
  let depositor;
  let claimer;
  let otherAccount;

  beforeEach(async function () {
    [owner, depositor, claimer, otherAccount] = await ethers.getSigners();
    
    const Escrow = await ethers.getContractFactory("Escrow");
    escrow = await Escrow.deploy();
    await escrow.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should deploy successfully", async function () {
      expect(await escrow.getAddress()).to.not.equal(ethers.ZeroAddress);
    });

    it("Should start with zero balance", async function () {
      expect(await escrow.getBalance()).to.equal(0);
    });
  });

  describe("Deposit", function () {
    const depositAmount = ethers.parseEther("1.0");
    const expirationTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
    let hashlock;
    let depositId;

    beforeEach(async function () {
      // Generate a random secret and its hash (simulating Lightning Network invoice)
      const secret = "mysecret123"; // This would come from Lightning Network
      hashlock = ethers.keccak256(ethers.toUtf8Bytes(secret));
      
      // Create deposit ID (this would be computed in the contract)
      depositId = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ["address", "string", "uint256"],
          [depositor.address, hashlock, Math.floor(Date.now() / 1000)]
        )
      );
    });

    it("Should create a deposit successfully", async function () {
      const tx = await escrow.connect(depositor).deposit(
        claimer.address,
        expirationTime,
        hashlock,
        { value: depositAmount }
      );

      await expect(tx)
        .to.emit(escrow, "DepositCreated")
        .withArgs(depositId, depositor.address, claimer.address, depositAmount, expirationTime, hashlock);

      expect(await escrow.getBalance()).to.equal(depositAmount);
    });

    it("Should reject deposit with zero amount", async function () {
      await expect(
        escrow.connect(depositor).deposit(
          claimer.address,
          expirationTime,
          hashlock,
          { value: 0 }
        )
      ).to.be.revertedWith("Deposit amount must be greater than 0");
    });

    it("Should reject deposit with zero claimer address", async function () {
      await expect(
        escrow.connect(depositor).deposit(
          ethers.ZeroAddress,
          expirationTime,
          hashlock,
          { value: depositAmount }
        )
      ).to.be.revertedWith("Invalid claimer address");
    });

    it("Should reject deposit with past expiration time", async function () {
      const pastTime = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      
      await expect(
        escrow.connect(depositor).deposit(
          claimer.address,
          pastTime,
          hashlock,
          { value: depositAmount }
        )
      ).to.be.revertedWith("Expiration time must be in the future");
    });

    it("Should reject deposit with empty hashlock", async function () {
      await expect(
        escrow.connect(depositor).deposit(
          claimer.address,
          expirationTime,
          "",
          { value: depositAmount }
        )
      ).to.be.revertedWith("Hashlock cannot be empty");
    });
  });

  describe("Claim", function () {
    const depositAmount = ethers.parseEther("1.0");
    const expirationTime = Math.floor(Date.now() / 1000) + 3600;
    let secret;
    let hashlock;
    let depositId;

    beforeEach(async function () {
      secret = ethers.randomBytes(32);
      hashlock = ethers.keccak256(secret);
      
      // Create deposit
      await escrow.connect(depositor).deposit(
        claimer.address,
        expirationTime,
        hashlock,
        { value: depositAmount }
      );

      // Get the actual deposit ID from the event
      const filter = escrow.filters.DepositCreated();
      const events = await escrow.queryFilter(filter);
      depositId = events[0].args.depositId;
    });

    it("Should allow claimer to claim with correct secret", async function () {
      const initialBalance = await ethers.provider.getBalance(claimer.address);
      
      const tx = await escrow.connect(claimer).claim(depositId, secret);
      
      await expect(tx)
        .to.emit(escrow, "DepositClaimed")
        .withArgs(depositId, claimer.address, secret);

      const finalBalance = await ethers.provider.getBalance(claimer.address);
      expect(finalBalance).to.equal(initialBalance + depositAmount);
    });

    it("Should reject claim with wrong secret", async function () {
      const wrongSecret = "wrongsecret";
      
      await expect(
        escrow.connect(claimer).claim(depositId, wrongSecret)
      ).to.be.revertedWith("Invalid secret");
    });

    it("Should reject claim from non-claimer", async function () {
      await expect(
        escrow.connect(otherAccount).claim(depositId, secret)
      ).to.be.revertedWith("Only claimer can claim");
    });

    it("Should reject claim after expiration", async function () {
      // Fast forward time
      await ethers.provider.send("evm_increaseTime", [3601]);
      await ethers.provider.send("evm_mine");
      
      await expect(
        escrow.connect(claimer).claim(depositId, secret)
      ).to.be.revertedWith("Deposit expired");
    });

    it("Should reject claim of non-existent deposit", async function () {
      const fakeDepositId = ethers.randomBytes(32);
      
      await expect(
        escrow.connect(claimer).claim(fakeDepositId, secret)
      ).to.be.revertedWith("Deposit does not exist");
    });
  });

  describe("Cancel Deposit", function () {
    const depositAmount = ethers.parseEther("1.0");
    const expirationTime = Math.floor(Date.now() / 1000) + 3600;
    let hashlock;
    let depositId;

    beforeEach(async function () {
      const secret = ethers.randomBytes(32);
      hashlock = ethers.keccak256(secret);
      
      // Create deposit
      await escrow.connect(depositor).deposit(
        claimer.address,
        expirationTime,
        hashlock,
        { value: depositAmount }
      );

      // Get the actual deposit ID from the event
      const filter = escrow.filters.DepositCreated();
      const events = await escrow.queryFilter(filter);
      depositId = events[0].args.depositId;
    });

    it("Should allow depositor to cancel after expiration", async function () {
      const initialBalance = await ethers.provider.getBalance(depositor.address);
      
      // Fast forward time past expiration
      await ethers.provider.send("evm_increaseTime", [3601]);
      await ethers.provider.send("evm_mine");
      
      const tx = await escrow.connect(depositor).cancelDeposit(depositId);
      
      await expect(tx)
        .to.emit(escrow, "DepositCancelled")
        .withArgs(depositId, depositor.address);

      const finalBalance = await ethers.provider.getBalance(depositor.address);
      expect(finalBalance).to.equal(initialBalance + depositAmount);
    });

    it("Should reject cancellation before expiration", async function () {
      await expect(
        escrow.connect(depositor).cancelDeposit(depositId)
      ).to.be.revertedWith("Deposit not yet expired");
    });

    it("Should reject cancellation from non-depositor", async function () {
      // Fast forward time past expiration
      await ethers.provider.send("evm_increaseTime", [3601]);
      await ethers.provider.send("evm_mine");
      
      await expect(
        escrow.connect(otherAccount).cancelDeposit(depositId)
      ).to.be.revertedWith("Only depositor can cancel");
    });

    it("Should reject cancellation of non-existent deposit", async function () {
      const fakeDepositId = ethers.randomBytes(32);
      
      await expect(
        escrow.connect(depositor).cancelDeposit(fakeDepositId)
      ).to.be.revertedWith("Deposit does not exist");
    });
  });

  describe("View Functions", function () {
    const depositAmount = ethers.parseEther("1.0");
    const expirationTime = Math.floor(Date.now() / 1000) + 3600;
    let hashlock;
    let depositId;

    beforeEach(async function () {
      const secret = ethers.randomBytes(32);
      hashlock = ethers.keccak256(secret);
      
      // Create deposit
      await escrow.connect(depositor).deposit(
        claimer.address,
        expirationTime,
        hashlock,
        { value: depositAmount }
      );

      // Get the actual deposit ID from the event
      const filter = escrow.filters.DepositCreated();
      const events = await escrow.queryFilter(filter);
      depositId = events[0].args.depositId;
    });

    it("Should return correct deposit details", async function () {
      const depositDetails = await escrow.getDeposit(depositId);
      
      expect(depositDetails.depositor).to.equal(depositor.address);
      expect(depositDetails.claimer).to.equal(claimer.address);
      expect(depositDetails.amount).to.equal(depositAmount);
      expect(depositDetails.expirationTime).to.equal(expirationTime);
      expect(depositDetails.hashlock).to.equal(hashlock);
      expect(depositDetails.claimed).to.be.false;
      expect(depositDetails.cancelled).to.be.false;
    });

    it("Should correctly check expiration status", async function () {
      expect(await escrow.isExpired(depositId)).to.be.false;
      
      // Fast forward time past expiration
      await ethers.provider.send("evm_increaseTime", [3601]);
      await ethers.provider.send("evm_mine");
      
      expect(await escrow.isExpired(depositId)).to.be.true;
    });

    it("Should return correct contract balance", async function () {
      expect(await escrow.getBalance()).to.equal(depositAmount);
    });
  });

  describe("Complete Workflow", function () {
    it("Should handle complete deposit -> claim workflow", async function () {
      const depositAmount = ethers.parseEther("2.0");
      const expirationTime = Math.floor(Date.now() / 1000) + 3600;
      const secret = "lightningsecret456";
      const hashlock = ethers.keccak256(ethers.toUtf8Bytes(secret));
      
      // Step 1: Create deposit
      const depositTx = await escrow.connect(depositor).deposit(
        claimer.address,
        expirationTime,
        hashlock,
        { value: depositAmount }
      );
      
      const depositEvents = await escrow.queryFilter(escrow.filters.DepositCreated());
      const depositId = depositEvents[0].args.depositId;
      
      // Step 2: Claim deposit
      const claimTx = await escrow.connect(claimer).claim(depositId, secret);
      
      // Step 3: Verify final state
      const depositDetails = await escrow.getDeposit(depositId);
      expect(depositDetails.claimed).to.be.true;
      expect(depositDetails.cancelled).to.be.false;
      expect(await escrow.getBalance()).to.equal(0);
    });

    it("Should handle complete deposit -> cancel workflow", async function () {
      const depositAmount = ethers.parseEther("1.5");
      const expirationTime = Math.floor(Date.now() / 1000) + 3600;
      const secret = ethers.randomBytes(32);
      const hashlock = ethers.keccak256(secret);
      
      // Step 1: Create deposit
      await escrow.connect(depositor).deposit(
        claimer.address,
        expirationTime,
        hashlock,
        { value: depositAmount }
      );
      
      const depositEvents = await escrow.queryFilter(escrow.filters.DepositCreated());
      const depositId = depositEvents[0].args.depositId;
      
      // Step 2: Wait for expiration and cancel
      await ethers.provider.send("evm_increaseTime", [3601]);
      await ethers.provider.send("evm_mine");
      
      const cancelTx = await escrow.connect(depositor).cancelDeposit(depositId);
      
      // Step 3: Verify final state
      const depositDetails = await escrow.getDeposit(depositId);
      expect(depositDetails.claimed).to.be.false;
      expect(depositDetails.cancelled).to.be.true;
      expect(await escrow.getBalance()).to.equal(0);
    });
  });
}); 