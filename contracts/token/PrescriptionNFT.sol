pragma solidity ^0.5.9;
pragma experimental ABIEncoderV2;
import "./ERC721.sol";
import "./SafeMath.sol";

/**
 * Notes:
 * @title PrescriptionNFT
 * Prescription Non-Fungible Token implementation for the required functionality of the ERC721 standard
 *
 */
contract PrescriptionNFT is ERC721 {
  using SafeMath for uint256;

  address public owner;

  struct PrescriptionMetadata {
    //address of doctor that issued this prescription
    address doctor;
    //address of Patient that receives this prescription
    address prescribedPatient;
    //PZN of medication (8 digits)
    string pzn;
    //Scientific name of the medicine
    string medicationName;
    //payload per pill
    uint8 dosage;
    //Unit for the dosage (mg, `ml, etc)
    string dosageUnit;
    //Number of pills to give in the prescription
    uint8 numPills;
    //Epoch time when the prescription was given (mint time)
    uint256 dateFilled;
    //Epoch expiration date (When is this prescription no longer valid)
    uint256 expirationTime;
  }

  struct Prescription {
    PrescriptionMetadata metadata;
    address owner;
    bool filled;
  }

  //metadata for a Doctor
  struct Doctor {
    string name;
    bool isValid;
  }

  //Total number of token that have been minted
  uint256 private totalTokens;  

  /*
   *  Mappings 
   */
  //Map of the certified doctors Map<tokenId, Prescription>  
  mapping (uint256 => Prescription) public prescriptions;

  //Map of the certified doctors Map<address, Doctor>
  mapping (address => Doctor) public approvedDoctors;

  // Mapping of tokens issued by a doctor
  mapping (address => uint256[]) private issuedTokens;

  // Mapping from owner to list of owned token IDs
  //May make this a map of maps: Map<address, tokenIds[]>
  mapping (address => uint256[]) private ownedTokens;

  // Mapping from token ID to index of the owner/issuer tokens list
  // need to delete elements from array
  mapping(uint256 => uint256) private ownedTokensIndex;
  mapping(uint256 => uint256) private issuedTokensIndex;

  /**
   * @dev NFT Constructor
   *    Create a new PrescriptionNFT with doctors that have already been approved
   *    The contract should be preloaded with gas 
   */
  constructor (address[] memory doctorAddresses, string[] memory doctorNames) public payable {
      owner = msg.sender;
      require(doctorAddresses.length == doctorNames.length);
      // For each of the provided certified doctors,
      // set that doctors credentials to valid
      for (uint i = 0; i < doctorAddresses.length; i++) {
          approvedDoctors[doctorAddresses[i]] = Doctor(doctorNames[i], true);
      }
  }


/*
 * CA methods
 */

  /**
  * @dev Approve a given doctor UUID. This will only be called by the CA
  * @param _doctorToApprove uint256 ID of doctor to approve for giving prescriptions
  */
  function approveDoctor(address _doctorToApprove, string memory _name) public payable onlyOwner {
      // set that doctor's credentials to valid
      approvedDoctors[_doctorToApprove] = Doctor(_name, true);
  }

  /**
  * @dev Remove a given doctor UUID. This will only be called by the CA
  * @param _doctorToRemove uint256 ID of doctor to approve for giving prescriptions
  */
  function removeDoctor(address _doctorToRemove) public payable onlyOwner {
    approvedDoctors[_doctorToRemove].isValid = false;
  }

 /*
 * Doctor methods
 */

  /**
  * @dev Fill the Prescription with the given tokenId. This means that the user will 
  *   transfer their Prescription tokens to the pharmacy address
  * @param _patientAddress wallet address of the patient to receive the prescription tokens
  * @param _pzn pzn number of medication
  * @param _medicationName medication name
  * @param _dosage payload per pill
  * @param _dosageUnit unit for payload per pill (mg, ml, etc)
  * @param _numPills number of pills that this token is good for 
  * @param _dateFilled epoch date when the token was minted
  * @param _expirationTime epoch date when the token expires
  */
  function prescribe(
    address _patientAddress,
    string memory _pzn,
    string memory _medicationName,
    uint8 _dosage,
    string memory _dosageUnit,
    uint8 _numPills,
    uint256 _dateFilled,
    uint256 _expirationTime) public doctorIsApproved(msg.sender) {
      //We will start the first tokenId at 0 and essentially treat it as an index
      //the next token id will just be = to the # of tokens 
      uint256 newTokenId = totalTokens;

      //Create a new Prescription token to the chain
      //Add a new Prescription token to the chain
      prescriptions[newTokenId].filled = false;
      prescriptions[newTokenId].metadata = PrescriptionMetadata(
        msg.sender,
        _patientAddress,
        _pzn,
        _medicationName,
        _dosage,
        _dosageUnit,
        _numPills,
        _dateFilled,
        _expirationTime
      );
      issuedTokensIndex[newTokenId] = issuedTokens[msg.sender].length;
      issuedTokens[msg.sender].push(newTokenId);
      //numTokens will get incremented in _mint
      //The token will also get created and sent to the patient
      _mint(_patientAddress, newTokenId);
  }

  /**
  * @dev Cancel an existing prescription
  * @param _tokenId id of the token to cancel (must be issued by doctor)
  */
  function cancelPrescription(uint256 _tokenId) public payable doctorIsApproved(msg.sender){
    //get prescription & verify prerequisites
    require(_tokenId < totalTokens);
    Prescription memory p = prescriptions[_tokenId];
    require(p.metadata.doctor == msg.sender);
    require(p.filled == false);
    //remove token
    removeToken(p.metadata.prescribedPatient, _tokenId);
    destroyToken(p.metadata.doctor, _tokenId);
  }

 /*
 * Patient methods
 */

  /**
  * @dev Fill the Prescription with the given tokenId. This means that the user will 
  *   transfer their Prescription tokens to the pharmacy address
  * @param _pharmacyAddress uint256 ID of doctor to approve for giving prescriptions
  * @param _tokenId uint256 ID of Prescription token to send 
  */
  function fillPrescription(address _pharmacyAddress, uint256 _tokenId) public
    //hasNotExpired(_tokenId)
  {
      transfer(_pharmacyAddress, _tokenId);
      prescriptions[_tokenId].filled = true;
  }

  /*
   * Modifiers
   */

  /**
  *
  *
  */
  modifier onlyOwner {
    require(msg.sender == owner);
    _;
  }

  /**
  * @dev Guarantees prescription is not being used after its expiration date
  * @param _tokenId uint256 ID of the token to validate its ownership belongs to msg.sender
  */
  modifier hasNotExpired(uint256 _tokenId) {
    uint256 timeToExpiry = prescriptions[_tokenId].metadata.expirationTime - now;
    require(timeToExpiry > 0);
    _;
  }

  /**
  * @dev Guarantees that address belongs to a valid and approved doctor
  * @param _doctor address of the token to validate its ownership belongs to msg.sender
  */
  modifier doctorIsApproved(address _doctor) {
    require(approvedDoctors[_doctor].isValid);
    _;
  }

  /**
  * @dev Guarantees msg.sender is patient who was actually prescribed this token
  * @param _tokenId uint256 ID of the token to validate its ownership belongs to msg.sender
  */
  modifier onlyPrescribedUser(uint256 _tokenId) {
    require(prescriptions[_tokenId].metadata.prescribedPatient == msg.sender);
    _;
  }

  /**
  * @dev Guarantees msg.sender is owner of the given token
  * @param _tokenId uint256 ID of the token to validate its ownership belongs to msg.sender
  */
  modifier onlyOwnerOf(uint256 _tokenId) {
    require(ownerOf(_tokenId) == msg.sender);
    _;
  }

  /*
   *  Public Getters
   */

  /**
  * @dev Gets the total amount of tokens stored by the contract
  * @return uint256 representing the total amount of tokens
  */
  function totalSupply() public view returns (uint256) {
    return totalTokens;
  }

  /**
  * @dev Gets the balance of the specified address
  * @param _owner address to query the balance of
  * @return uint256 representing the amount owned by the passed address
  */
  function balanceOf(address _owner) public view returns (uint256) {
    return ownedTokens[_owner].length;
  }

  /**
  * @dev Gets the list of tokens issued by a given address
  * @return uint256[] representing the list of tokens issued by the passed address
  */
  function tokensIssued(address _doctor) public view returns (uint256[] memory) {
    return issuedTokens[_doctor];
  }
  /**
  * @dev Gets the list of tokens owned by a given address
  * @param _owner address to query the tokens of
  * @return uint256[] representing the list of tokens owned by the passed address
  */
  function tokensOf(address _owner) public view returns (uint256[] memory) {
    return ownedTokens[_owner];
  }

  /**
  * @dev Gets the owner of the specified token ID
  * @param _tokenId uint256 ID of the token to query the owner of
  * @return owner address currently marked as the owner of the given token ID
  */
  function ownerOf(uint256 _tokenId) public view returns (address) {
    address tokenOwner = prescriptions[_tokenId].owner;
    require(tokenOwner != address(0));
    return tokenOwner;
  }

  /**
  * @dev Transfers the ownership of a given token ID to another address
  * @param _to address to receive the ownership of the given token ID
  * @param _tokenId uint256 ID of the token to be transferred
  */
  function transfer(address _to, uint256 _tokenId) public onlyOwnerOf(_tokenId) onlyPrescribedUser(_tokenId) {
    removeTokenAndTransfer(msg.sender, _to, _tokenId);
  }

  /**
  * @dev Mint token function
  * @param _to The address that will own the minted token
  * @param _tokenId uint256 ID of the token to be minted by the msg.sender
  */
  function _mint(address _to, uint256 _tokenId) internal {
    require(_to != address(0));
    addToken(_to, _tokenId);
    emit Transfer(address(0), _to, _tokenId);
  }

  /**
  * @dev Internal function to clear current approval and transfer the ownership of a given token ID
  * @param _from address which you want to send tokens from
  * @param _to address which you want to transfer the token to
  * @param _tokenId uint256 ID of the token to be transferred
  */
  function removeTokenAndTransfer(address _from, address _to, uint256 _tokenId) internal {
    require(_to != address(0));
    require(_to != ownerOf(_tokenId));
    require(ownerOf(_tokenId) == _from);

    removeToken(_from, _tokenId);
    addToken(_to, _tokenId);
    emit Transfer(_from, _to, _tokenId);
  }

  /**
  * @dev Internal function to add a token ID to the list of a given address
  * @param _to address representing the new owner of the given token ID
  * @param _tokenId uint256 ID of the token to be added to the tokens list of the given address
  */
  //add event logger there
  function addToken(address _to, uint256 _tokenId) private {
    require(prescriptions[_tokenId].owner == address(0));
    prescriptions[_tokenId].owner = _to;
    uint256 length = balanceOf(_to);

    ownedTokens[_to].push(_tokenId);
    ownedTokensIndex[_tokenId] = length;
    totalTokens = totalTokens.add(1);
  }

  /**
  * @dev Internal function to remove a token ID from the list of a given address
  * @param _from address representing the previous owner of the given token ID
  * @param _tokenId uint256 ID of the token to be removed from the tokens list of the given address
  */
  function removeToken(address _from, uint256 _tokenId) private {
    require(ownerOf(_tokenId) == _from);

    //delete ownedTokens entry
    uint256 tokenIndex = ownedTokensIndex[_tokenId];
    uint256 lastTokenIndex = balanceOf(_from).sub(1);
    uint256 lastToken = ownedTokens[_from][lastTokenIndex];
    ownedTokens[_from][tokenIndex] = lastToken;
    ownedTokens[_from][lastTokenIndex] = 0;
    ownedTokens[_from].length--;
    ownedTokensIndex[_tokenId] = 0;
    ownedTokensIndex[lastToken] = tokenIndex;

    prescriptions[_tokenId].owner = address(0);
  }

  /**
    * @dev Internal function to remove token from issuer list and prescriptions mapping
    * @param _doctor address representing the issuer of a given token
    * @param _tokenId uint256 ID of the token to be removed from the tokens list of the given address
    */
  function destroyToken(address _doctor, uint256 _tokenId) private {
    //delete issuedTokens entry
    uint256 tokenIndex = issuedTokensIndex[_tokenId];
    uint256 lastTokenIndex = issuedTokens[_doctor].length.sub(1);
    uint256 lastToken = issuedTokens[_doctor][lastTokenIndex];
    issuedTokens[_doctor][tokenIndex] = lastToken;
    issuedTokens[_doctor][lastTokenIndex] = 0;
    issuedTokens[_doctor].length--;
    issuedTokensIndex[_tokenId] = 0;
    issuedTokensIndex[lastToken] = tokenIndex;

    delete prescriptions[_tokenId];
  }

  //  
  //  @dev no_op these function since approval doesn't meet our use case
  //  
 function approve(address _to, uint256 _tokenId) public{
     //no_op
 }
 
 function takeOwnership(uint256 _tokenId) public{
     //no_op
 }

}
