const PrescriptionNFT = artifacts.require("PrescriptionNFT");

contract("PrescriptionNFT", accounts => {

    it("should prescribe prescription to patient", async () => {
        let i = await PrescriptionNFT.deployed();
        let tx = await i.prescribe(accounts[1], '12345678', 'Aspirin Complex', 23, 'ml', 3, Math.floor(Date.now()/1000), Math.floor(Date.now()/1000 - 86400), {from: accounts[4]});
        assert.equal(tx.receipt.status, true, "Transaction failed");

        let tokens = await i.tokensOf(accounts[1]);
        assert.equal(tokens.length, 1, "Token was not created");

        let tokensIssued = await i.tokensIssued(accounts[4]);
        assert.equal(tokensIssued.length, 1, "Token not issued")
    });

    it("should retrieve the contents of an existing token and verify contents", async () => {
        let i = await PrescriptionNFT.deployed();
        let tokens = await i.tokensOf(accounts[1]);

        let prescription = await i.prescriptions(tokens[0]);
        assert.equal(prescription.metadata.doctor, accounts[4], "Wrong Doctor");
        assert.equal(prescription.metadata.medicationName, "Aspirin Complex", "Wrong Medication Name")
    });

    it("should fill one prescription by transferring it from patient to pharmacy", async () => {
        let i = await PrescriptionNFT.deployed();
        let tokens = await i.tokensOf(accounts[1]);
        let p = await i.prescriptions(tokens[0]);
        assert.isAtLeast(tokens.length, 1, "Account has no tokens");

        let tx = await i.fillPrescription(accounts[2], tokens[0], {from: accounts[1]});
        assert.isTrue(tx.receipt.status, "Transaction failed");

        tokens = await i.tokensOf(accounts[2]);

        assert.equal(tokens.length, 1, "Token was not transferred");
    });

    it("should issue a prescription and cancel it again", async() => {
        let i = await PrescriptionNFT.deployed();
        let tx = await i.prescribe(accounts[7], '12345678', 'Aspirin Complex', 23, 'ml', 3, Date.now(), Date.now() + 86400, {from: accounts[5]});

        let tokens = await i.tokensOf(accounts[7]);
        assert.equal(tokens.length, 1, "Token not created");

        let tx2 = await i.cancelPrescription(tokens[0], {from: accounts[5]});

        let tokens2 = await i.tokensOf(accounts[7]);
        assert.equal(tokens2.length, 0, "Token not cancelled")
        tokens2 = await i.tokensIssued(accounts[5]);
        assert.equal(tokens2.length, 0, "Token not removed from issued tokens")
    });

    it("should approve a new doctor", async() => {
        let i = await PrescriptionNFT.deployed();
        let tx = await i.approveDoctor(accounts[9], 'Dr. Smithy');
        let doctor = await i.approvedDoctors(accounts[9]);
        assert.isTrue(doctor.isValid, 'Doctor name incorrect')
        assert.equal(doctor.name, 'Dr. Smithy', 'Doctor name incorrect')
    });

    it("should remove an existing verified doctor's approval state", async() => {
        let i = await PrescriptionNFT.deployed();
        let tx = await i.removeDoctor(accounts[9]);
        let doctor = await i.approvedDoctors(accounts[9]);
        assert.isFalse(doctor.isValid)
    });


});
