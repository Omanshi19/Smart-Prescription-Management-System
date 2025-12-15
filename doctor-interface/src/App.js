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
import QRModal from './QRModal'
import './App.css';
import drugs from './drugs.json';
import Autocomplete from 'react-autocomplete';
import 'font-awesome/css/font-awesome.min.css';

import 'bootstrap/dist/css/bootstrap.css';
import { Paginationbar } from 'reactstrap-paginationbar';

import {
  Button,
  Form,
  FormFeedback,
  FormGroup,
  Input,
  Label,
  Media,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Table
} from 'reactstrap';
let FontAwesome = require('react-fontawesome');
let utils = require('./utils.js');

class ModalForm extends Component {
  constructor(props) {
    super(props);
    this.state = {
      formState: { "dosage-unit": "ml" },
      transactionTriggered: false
    };
  }

  async sendPrescription(e) {
    if(this.handleValidation()) {
      this.setState({
        transactionTriggered: true
      });
      this.props.state.ContractInstance.prescribe(
        this.state.formState["patient-address"],
        this.state.pzn,
        this.state.medicationName,
        this.state.formState["dosage-quantity"],
        this.state.formState["dosage-unit"],
        0,
        Date.now(),
        Date.parse(this.state.formState["expiration-date"]), {gasPrice: 400000000, gasLimit: 400000})
        .then((tx) => {
          this.props.state.transactionId = tx.hash;
          //access parent instance to refresh prescriptions
          this._reactInternalFiber._debugOwner.stateNode.getPrescriptions();
        })
        .catch((err) => {})
        .finally(() => {
          this.setState({
            transactionTriggered: false
          });
        })
    }
    else{
      e.preventDefault();
    }
  }

  handleValidation(){
    return (window.web3.isAddress(this.state.formState["patient-address"])) &&
      !(this.state.formState["expiration-date"] == null || this.state.formState["expiration-date"] === "");
  }

  inputUpdate(event) {
    const form = event.currentTarget;
    //const allFieldsValid = this.checkAllFieldsValid(form.elements);
    //this.setState({ formValid: allFieldsValid})
    this.setState({ formState: { ...this.state.formState, [event.target.name]: event.target.value }});
    return false;
  }

  checkAllFieldsValid = (formValues) => {
      let elements = Array.prototype.slice.call(formValues);
      return !elements.some(field => field.classList.contains('is-invalid'));
  };

  render () {
    if(this.props.input !== undefined && !this.props.input.pzn) this.state.formState["patient-address"] = this.props.input.patientWalletAddress;
    if(this.props.input !== undefined && this.state.id !== this.props.input.id){
      this.state.id = this.props.input.id;
      this.state.formState["patient-address"] = this.props.input.patientWalletAddress;
      this.state.pzn = this.props.input.pzn;
      this.state.medicationName = this.props.input.medicationName;
      this.state.formState["dosage-quantity"] = this.props.input.dosage;
      this.state.formState["dosage-unit"] = this.props.input.dosageUnit;
      if(this.props.input.expiryTime instanceof Date)
        this.state.formState["expiration-date"] = this.props.input.expiryTime.toISOString().substring(0, 10);
    }

    if (this.props.state.transactionId) {
    let html = (
      <Modal isOpen={this.props.visibility} toggle={this.props.toggle}>
        <ModalHeader toggle={this.props.toggle}><FontAwesome name='check-circle'/> Your prescription has been sent!</ModalHeader>
        <ModalBody>
          <p>Your prescription has successfully been sent to the patient and is available at the following transaction address: <code>{this.props.state.transactionId}</code></p>
        </ModalBody>
      </Modal>);
    return html;
    } else {
    return (
      <Modal isOpen={this.props.visibility} toggle={this.props.toggle}>
        <ModalHeader toggle={this.props.toggle}>Create a prescription</ModalHeader>
        <ModalBody>
          <Form onInput={this.inputUpdate.bind(this)} tooltip="">
            <FormGroup>
              <Label for="exampleEmail">Patient wallet address</Label>
              <Input type="text" name="patient-address"  value={this.state.formState["patient-address"] || ""} placeholder="0x123f681646d4a755815f9cb19e1acc8565a0c2ac" required valid invalid={!window.web3.isAddress(this.state.formState["patient-address"])}/>
              <FormFeedback>Not a valid address</FormFeedback>
            </FormGroup>
            <FormGroup>
              <Label for="exampleEmail">PZN</Label>
              <Autocomplete
                getItemValue={(item) => item.label}
                items={ drugs.map(function(drug){
                  return {
                    label : drug.PZN.toString() + " " + drug.Medikament,
                    value: drug.PZN.toString() + '|' + drug.Medikament,
                  }; }) }
                shouldItemRender={(item, value) => true}
                getItemValue={item => item.value}
                wrapperStyle={{}}
                renderItem={(item, highlighted) =>
                  <div
                    key={item.id}
                    style={{ backgroundColor: highlighted ? '#eee' : 'transparent'}}
                  >
                    {item.label}
                  </div>
                }
                type="text"
                name = "pzn"
                inputProps={{className: "form-control"}}
                required
                value={this.state.pzn || ""}
                onChange={e => this.setState({pzn : e.target.value.split('|')[0], medicationName: e.target.value.split('|')[1]} )}
                onSelect={(val) => this.setState({pzn : val.split('|')[0], medicationName: val.split('|')[1]})}
              />
            </FormGroup>
            <FormGroup>
              <Label for="exampleEmail">Medication Name</Label>
              <Input type="text" name="medication-name"  value={this.state.medicationName || ""} required/>
            </FormGroup>
            <FormGroup>
              <Label for="exampleEmail">Dosage</Label>
              <Input type="number" name="dosage-quantity"  value={this.state.formState["dosage-quantity"] || ""} required/>
            </FormGroup>
            <FormGroup>
              <Label for="exampleEmail">Dosage Unit</Label>
              <Input on type="select" name="dosage-unit"  value={this.state.formState["dosage-unit"] || ""} required>
                <option value="ml">ml</option>
                <option value="mg">mg</option>
                <option value="tablets">tablets</option>
              </Input>
            </FormGroup>
            <FormGroup>
              <Label for="exampleEmail">Expiration Date</Label>
              <Input type="date" min={(new Date((new Date()).getTime() + (7*60*60*24*1000))).toISOString().substr(0,10)} name="expiration-date" placeholder=""  value={this.state.formState["expiration-date"] || ""} invalid={this.state.formState["expiration-date"] == null || this.state.formState["expiration-date"] === ""} required/>
                <FormFeedback>Not a valid date</FormFeedback>
            </FormGroup>
          </Form>
        </ModalBody>
        <ModalFooter>
          <div className="container mt-0">
            <div className="row">
              <Button className="col mr-1" color="secondary" onClick={this.props.toggle}>Cancel</Button>{' '}
              <Button className="col" color="primary" onClick={this.sendPrescription.bind(this)} disabled={this.state.transactionTriggered}>Send Prescription</Button>
            </div>
            {this.state.transactionTriggered &&
            <div className="row mt-2"><p className="mb-0">Transaction was triggered. Please confirm it in MetaMask.</p></div>
            }
          </div>
        </ModalFooter>
      </Modal>
    );
    }
  }
}

ModalForm.contextTypes = {
  web3: PropTypes.object
};


class App extends Component {
  constructor(props) {
    super(props);
    let pageSize = 5;
    this.state = {
      loaded: false,
      modal: false,
      accounts: [],
      transactionLogs: [],
      pageSize: pageSize,
      fromItem: 0,
      toItem: pageSize - 1
    };

    this.toggle = this.toggle.bind(this);
    this.toggleQR = this.toggleQR.bind(this);
  }

  async componentDidMount() {
    let {accounts, instance} = await utils.setupContract();
    this.state.accounts = accounts;
    this.state.ContractInstance = instance;
    await this.getPrescriptions();
    let doctor = await this.state.ContractInstance.approvedDoctors(this.state.accounts[0]);
    this.setState({
      user: doctor.name,
      loaded: true
    });
    //this.forceUpdate()
  }

  async getPrescriptions(page) {
    let tokens = await this.state.ContractInstance.tokensIssued(this.state.accounts[0]);
    let transactionLogs = await Promise.all(tokens.reverse().map(this.getPrescription, this));
    let d = await this.getPrescription(1);
    this.setState({transactionLogs: transactionLogs})
  };

  async getPrescription(token){
    let f = await this.state.ContractInstance.prescriptions(token);
    return {
      id: token,
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

  async cancelPrescription(tx) {
    let f = await this.state.ContractInstance.cancelPrescription(tx.id.toNumber());
  }

  toggle() {
    this.setState({modal: !this.state.modal});
  }

  toggleQR() {
    this.setState({modalQR: !this.state.modalQR});
  }

  new(){
    //if pre-filled from renew, reset. otherwise keep scanned address
    if((this.state.prior && this.state.prior.pzn) || this.state.transactionId){
      this.state.prior = {};
      this.state.transactionId = false;
    }
    this.toggle()
  }

  renew(tx) {
    this.state.prior = tx;
    this.toggle()
  }

  saveAddress(address){
    if(!this.state.prior) this.state.prior = {};
    this.state.prior.patientWalletAddress = address;
  }

  renderTableRow(tx) {
    return (
      <tr key={tx.id}>
        <td>
          <small  data-toggle="tooltip" data-placement="top" title={tx.patientWalletAddress}>
            {tx.patientWalletAddress.substr(0, 20) + "..."}
          </small>
        </td>
        <td>{tx.pzn}</td>
        <td>{tx.dosage} {tx.dosageUnit} of {tx.medicationName}</td>
        <td>{new Date(tx.expiryTime).toLocaleDateString("en-US")}</td>
        <td>{new Date(tx.prescribedAt).toLocaleDateString("en-US")}</td>
        <td>
          <Button color="primary" size="sm" onClick={() => { this.renew(tx) }}>Renew</Button>{' '}
          { !tx.filled &&
            <Button color="secondary" size="sm" onClick={() => {
              this.cancelPrescription(tx)
            }}>Cancel</Button>
          }
        </td>
      </tr>
    )
  }

  render() {
    return (
      <div className="App container">
        <strong style={{verticalAlign: "middle"}}>Doctor Portal</strong>
        <a href="http://trio.bayern" target="_blank" rel="noopener noreferrer"><Media object src="./logo.svg" style={{ marginRight: 15 }} height="30px" align="right"/></a>
        <hr />
        {(this.state.loaded && this.state.user) &&
        <div>
          <div className="row position-relative">
            <div className="col">
              <Media>
                <FontAwesome className="doctor-icon" object name='user-md' alt="User" size={"5x"}/>
                <Media body>
                  <h1>Hello {this.state.user},</h1>
                  <h4>Your recent prescriptions.</h4>
                  <code>{this.state.accounts[0]}</code>
                </Media>
              </Media>
            </div>
            <div className="col-md-6 text-right position-absolute" style={{bottom: 0, right: 0}}>
              <Button color="secondary" className="m-1" onClick={() => {
                this.toggleQR()
              }}><FontAwesome name='camera' className="mr-2"/> Scan patient address</Button>
              <Button color="success" className="m-1" onClick={() => {
                this.new(this)
              }}>Create a prescription</Button>
            </div>
          </div>
          <br />
          <Table>
            <thead>
              <tr>
                <th width={"16%"}>Patient address</th>
                <th width={"10%"}>PZN</th>
                <th width={"34%"}>Description</th>
                <th width={"10%"}>Expires at</th>
                <th width={"15%"}>Prescribed at</th>
                <th width={"15%"}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {this.state.transactionLogs
                .slice(this.state.fromItem, this.state.toItem + 1)
                .map(this.renderTableRow.bind(this))}
            </tbody>
          </Table>
          <Paginationbar
            totalItems={this.state.transactionLogs.length}
            pageSize={this.state.pageSize}
            onTurnPage={e => this.setState(e)}
          />
          <ModalForm visibility={this.state.modal} toggle={this.toggle} input={this.state.prior} state={this.state} onClosed={this.getPrescriptions}/>
          <QRModal visibility={this.state.modalQR} toggle={this.toggleQR} state={this.state} onScan={this.saveAddress}/>
        </div> }
        {(this.state.loaded && !this.state.user) &&
          <h1>You do not have Doctor permissions on this account.</h1>
        }
      </div>
    );
  }
}

App.contextTypes = {
  web3: PropTypes.object
};
export default App;
