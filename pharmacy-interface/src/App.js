/**
 * web3Context = {
 *   accounts: {Array<string>} - All accounts
 *   selectedAccount: {string} - Default ETH account address (coinbase)
 *   network: {string} - One of 'MAINNET', 'ROPSTEN', or 'UNKNOWN'
 *   networkId: {string} - The network ID (e.g. '1' for main net)
 }
*/

import React, {Component} from 'react';
import PropTypes from 'prop-types';
import './App.css';
import 'font-awesome/css/font-awesome.min.css';
import 'bootstrap/dist/css/bootstrap.css';
import {
  Media, Table,
  Modal, ModalHeader, ModalBody
} from 'reactstrap';
let QRCode = require('qrcode.react');
let FontAwesome = require('react-fontawesome');
let utils = require('./utils.js');

class QRModal extends Component {
  constructor(props) {
    super(props);
  }
  render () {
    return (
      <Modal isOpen={this.props.visibility} toggle={this.props.toggle}>
        <ModalHeader toggle={this.props.toggle}>Your Account Address</ModalHeader>
        <ModalBody>
          <code>{this.props.account}</code><br />< br/>
          <QRCode size="512" value={this.props.account} style={{width: "100%"}}/>
        </ModalBody>
      </Modal>
    )
  }
}

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      modal: false,
      transactionLogs: [],
      accounts: [],
      doctors: new Map()
    };

    this.toggleQR = this.toggleQR.bind(this);
  }

  async componentDidMount() {
    let {accounts, instance} = await utils.setupContract();
    this.setState({accounts: accounts});
    this.setState({ContractInstance: instance});
    await this.getPrescriptions();
    let addresses = new Set();
    for (let i = 0; i < this.state.transactionLogs.length; i++) {
      let doctor = this.state.transactionLogs[i].doctor;
      if(!addresses.has(doctor))
        addresses.add(doctor);
    }
    await this.getDoctors(addresses);
  }

  async getPrescriptions(page) {
    let tokens = await this.state.ContractInstance.tokensOf(this.state.accounts[0]);
    let transactionLogs = await Promise.all(tokens.reverse().map(this.getPrescription, this));
    transactionLogs = transactionLogs.filter(f => f.filled);
    this.setState({transactionLogs: transactionLogs})
  };

  async getPrescription(token){
    let f = await this.state.ContractInstance.prescriptions(token);
    return {
      id: token.toNumber(),
      doctor: f.metadata.doctor,
      expiryTime: new Date(f.metadata.expirationTime.toNumber()),
      prescribedAt: new Date(f.metadata.dateFilled.toNumber()),
      patientWalletAddress: f.metadata.prescribedPatient,
      pzn: f.metadata.pzn,
      medicationName: f.metadata.medicationName,
      dosage: f.metadata.dosage,
      dosageUnit: f.metadata.dosageUnit,
      filled: f.filled
    };
  }

  async getDoctors(addresses){
    let doctors = new Map();
    for (let address of addresses) {
      let f = await this.state.ContractInstance.approvedDoctors(address);
      if(f[1]) //approval
        doctors.set(address, f[0]);
    }

    this.setState({doctors: doctors});
  };

  toggleQR() {
    this.setState({modalQR: !this.state.modalQR});
  }

  renderTableRow(tx) {
    return (
      <tr key={tx.id}>
        <td>{tx.id}</td>
        <td>
          <small>
            {tx.patientWalletAddress}<br/>
            <FontAwesome name='check-circle' style={{ color: "green"}}/> Verified by {this.state.doctors.get(tx.doctor)}
          </small>
        </td>
        <td>{tx.pzn}</td>
        <td>{tx.dosage}{tx.dosageUnit} of {tx.brandName} ({tx.medicationName})</td>
        <td>{new Date(tx.expiryTime).toLocaleDateString("en-US")}</td>
        <td>{new Date(tx.prescribedAt).toLocaleDateString("en-US")}</td>
      </tr>
    )
  }

  render() {
    return (
      <div className="App container">
        <strong style={{verticalAlign: "middle"}}>Pharmacy Portal</strong>
        <a href="http://trio.bayern" target="_blank" rel="noopener noreferrer"><Media object src="./logo.svg" style={{ marginRight: 15 }} height="30px" align="right"/></a>
        <hr />
        <div className="row">
          <div className="col-md-10">
            <Media>
              <FontAwesome className="clickable user-icon" onClick={() => { this.toggleQR() }} name='heartbeat' alt="User" size={"5x"}/>
              <Media body>
                <h1>Hello, </h1>
                <h4>Prescription tokens transferred by patients:</h4>
                { this.state.accounts[0] !== undefined &&
                  <p>Tap your profile icon to show your account address.</p>
                }
              </Media>
            </Media>
          </div>
          <div className="col-md-2">
            <br />
          </div>
        </div>
        <br />
        <Table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Patient address</th>
              <th>PZN</th>
              <th>Description</th>
              <th>Expires at</th>
              <th>Prescribed at</th>
            </tr>
          </thead>
          <tbody>
            {this.state.transactionLogs.map(this.renderTableRow.bind(this))}
          </tbody>
        </Table>

        <QRModal visibility={this.state.modalQR} toggle={this.toggleQR} account={this.state.accounts[0]}/>
      </div>
    );
  }
}

App.contextTypes = {
  web3: PropTypes.object
};
export default App;
