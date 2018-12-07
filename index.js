'use strict'

const keys = {
  name: 'name',
  symbol: 'symbol',
  tokens: 'tokens',
  tokenIndexToOwner: 'tokenIndexToOwner',
  ownershipTokenCount: 'ownershipTokenCount',
  tokenIndexToApproved: 'tokenIndexToApproved'
}

// ================== bof: internal function ==============
function _setStorage (key, value) {
  storageStore(key, JSON.stringify(value))
}

function _getStorage (key) {
  let data = storageLoad(key)
  return JSON.parse(data)
}

function _isTokenId (_argumentName, _tokenId) {
  assert((typeof _tokenId === 'number' && _tokenId >= 0), `${_argumentName} argument must be a number and great equal to 0`)
}

function _isAddress (_functionName, _argumentName, _address) {
  assert(addressCheck(_address) === true, `${_argumentName} argument is not a valid address to ${_functionName}()`)
}

/**
 * 地址__claimant是否是_tokenId的所有者
 * @param {string} _claimant
 * @param {number} _tokenId
 * @return {boolean}
 * @private
 */
function _owns (_claimant, _tokenId) {
  const tokenIndexToOwner = _getStorage(keys.tokenIndexToOwner)
  return tokenIndexToOwner[_tokenId] === _claimant
}

/**
 * _claimant是否具有通过transferFrom()函数转移_tokenId的能力
 * @param {string} _claimant - 提出要求的地址
 * @param {number} _tokenId - kitten id
 * @return {boolean}
 * @private
 */
function _approvedFor (_claimant, _tokenId) {
  const tokenIndexToApproved = _getStorage(keys.tokenIndexToApproved)
  return tokenIndexToApproved[_tokenId] === _claimant
}

/**
 * 让地址_approved具有转移tokenId的能力
 * @param {number} _tokenId
 * @param {string} _approved
 * @private
 */
function _approve (_tokenId, _approved) {
  const tokenIndexToApproved = _getStorage(keys.tokenIndexToApproved)
  tokenIndexToApproved[_tokenId] = _approved
}

/**
 * 将_tokenId的所有权，从地址_from转移到地址_to
 * @param {string} _from
 * @param {string} _to
 * @param {number} _tokenId
 * @private
 */
function _transfer (_from, _to, _tokenId) {
  const ownershipTokenCount = _getStorage(keys.ownershipTokenCount)
  const tokenIndexToOwner = _getStorage(keys.tokenIndexToOwner)
  const tokenIndexToApproved = _getStorage(keys.tokenIndexToApproved)

  if (ownershipTokenCount[_from]) {
    ownershipTokenCount[_from] -= 1
  }

  ownershipTokenCount[_to] = (ownershipTokenCount[_to] || 0) + 1
  // ownershipTokenCount[_to] += 1;
  // transfer ownership
  tokenIndexToOwner[_tokenId] = _to
  // 转移完成后，收回_tokenId的授权地址
  delete tokenIndexToApproved[_tokenId]

  _setStorage(keys.ownershipTokenCount, ownershipTokenCount)
  _setStorage(keys.tokenIndexToOwner, tokenIndexToOwner)
  _setStorage(keys.tokenIndexToApproved, tokenIndexToApproved)
}
// ================== eof: internal function ==============

/**
 * 创建一个token
 * @param       {number} _matronId   [女人]
 * @param       {number} _sireId     [男人]
 * @param       {number} _generation [代数：第几代]
 * @param       {number} _genes      [基因]
 * @param       {string} _owner      [拥有者]
 *
 * @return      {number}             [tokenId]
 */
function _createToken (_owner) {
  const _token = {
    birthTime: blockTimestamp
  }
  const tokens = _getStorage(keys.tokens)
  const newTokenId = tokens.push(_token) - 1
  _setStorage(keys.tokens, tokens)

  _transfer(sender, _owner, newTokenId)
  return newTokenId
}

// ******************************************************************
// ERC721需要实现的函数
// ******************************************************************

/**
 * 发行的token总数
 * @return {number} [token总数]
 */
function totalSupply () {
  const tokens = _getStorage(keys.tokens)
  return tokens.length
}

/**
 * _owner 有多少个token
 * @param  {string} _owner [所有这地址]
 * @return {number}        [description]
 */
function balanceOf (_owner) {
  _isAddress('balanceOf', '_owner', _owner)
  const ownershipTokenCount = _getStorage(keys.ownershipTokenCount)
  return ownershipTokenCount[_owner] || 0
}

/**
 * 获取 _tokenId 的所有者地址
 * @param  {number} _tokenId [tokenId]
 * @return {string}
 */
function ownerOf (_tokenId) {
  _isTokenId('_tokenId', _tokenId)
  const tokenIndexToOwner = _getStorage(keys.tokenIndexToOwner)
  return tokenIndexToOwner[_tokenId] || ''
}

/**
 * 批准地址_to具有转移_tokenId的能力，即：
 * 批准地址_to可以通过transferFrom转移_tokenId
 * @param  {string} _to      [待批准者的地址]
 * @param  {number} _tokenId [tokenId]
 * @return {boolean}          [是否批准]
 */
function approve (_to, _tokenId) {
  _isAddress('approve', '_to', _to)
  _isTokenId('_tokenId', _tokenId)
  // Only an owner can grant transfer approval.
  assert(_owns(sender, _tokenId), 'only an owner can grant transfer approval')
  // Register the approval (replacing any previous approval).
  _approve(_tokenId, _to)
}

/**
 * 转移_tokenId给_to
 * @param  {string} _to      [地址]
 * @param  {number} _tokenId [tokenId]
 * @return {boolean}          [是否转移成功]
 */
function transfer (_to, _tokenId) {
  _isAddress('transfer', '_to', _to)
  _isTokenId('_tokenId', _tokenId)
  // 禁止转让给本合约以防止意外滥用，合约账户永远不应该拥有小猫
  assert(_to !== thisAddress, '_to argument cannot be equal to the contract account address')
  // You can only send your own cat.
  assert(_owns(sender, _tokenId), `${sender} can only send your own cat`)
  // Reassign ownership, clear pending approvals, emit Transfer event.
  _transfer(sender, _to, _tokenId)
}

/**
 * 从_from转移_tokenId到_to
 * @param  {string} _from    [地址]
 * @param  {string} _to      [地址]
 * @param  {number} _tokenId [tokenId]
 * @return {boolean}          [是否转移成功]
 */
function transferFrom (_from, _to, _tokenId) {
  // 禁止转让给本合约以防止意外滥用，合约账户永远不应该拥有小猫
  assert(_to !== thisAddress, '_to argument cannot be equal to the contract account address')
  // Check for approval and valid ownership
  // 检查批准和有效所有权
  // 只有所有者和被授权的账户才能进行转移
  assert(_approvedFor(sender, _tokenId), `${sender} not approved`)
  assert(_owns(_from, _tokenId), '')
  'use strict'

  const keys = {
    name: 'name',
    symbol: 'symbol',
    tokens: 'tokens',
    tokenIndexToOwner: 'tokenIndexToOwner',
    ownershipTokenCount: 'ownershipTokenCount',
    tokenIndexToApproved: 'tokenIndexToApproved'
  }

// ================== bof: internal function ==============
  function _setStorage (key, value) {
    storageStore(key, JSON.stringify(value))
  }

  function _getStorage (key) {
    let data = storageLoad(key)
    return JSON.parse(data)
  }

  function _isTokenId (_argumentName, _tokenId) {
    assert((typeof _tokenId === 'number' && _tokenId >= 0), `${_argumentName} argument must be a number and great equal to 0`)
  }

  function _isAddress (_functionName, _argumentName, _address) {
    assert(addressCheck(_address) === true, `${_argumentName} argument is not a valid address to ${_functionName}()`)
  }

  /**
   * 地址__claimant是否是_tokenId的所有者
   * @param {string} _claimant
   * @param {number} _tokenId
   * @return {boolean}
   * @private
   */
  function _owns (_claimant, _tokenId) {
    const tokenIndexToOwner = _getStorage(keys.tokenIndexToOwner)
    return tokenIndexToOwner[_tokenId] === _claimant
  }

  /**
   * _claimant是否具有通过transferFrom()函数转移_tokenId的能力
   * @param {string} _claimant - 提出要求的地址
   * @param {number} _tokenId - kitten id
   * @return {boolean}
   * @private
   */
  function _approvedFor (_claimant, _tokenId) {
    const tokenIndexToApproved = _getStorage(keys.tokenIndexToApproved)
    return tokenIndexToApproved[_tokenId] === _claimant
  }

  /**
   * 让地址_approved具有转移tokenId的能力
   * @param {number} _tokenId
   * @param {string} _approved
   * @private
   */
  function _approve (_tokenId, _approved) {
    const tokenIndexToApproved = _getStorage(keys.tokenIndexToApproved)
    tokenIndexToApproved[_tokenId] = _approved
  }

  /**
   * 将_tokenId的所有权，从地址_from转移到地址_to
   * @param {string} _from
   * @param {string} _to
   * @param {number} _tokenId
   * @private
   */
  function _transfer (_from, _to, _tokenId) {
    const ownershipTokenCount = _getStorage(keys.ownershipTokenCount)
    const tokenIndexToOwner = _getStorage(keys.tokenIndexToOwner)
    const tokenIndexToApproved = _getStorage(keys.tokenIndexToApproved)

    if (ownershipTokenCount[_from]) {
      ownershipTokenCount[_from] -= 1
    }

    ownershipTokenCount[_to] = (ownershipTokenCount[_to] || 0) + 1
    // ownershipTokenCount[_to] += 1;
    // transfer ownership
    tokenIndexToOwner[_tokenId] = _to
    // 转移完成后，收回_tokenId的授权地址
    delete tokenIndexToApproved[_tokenId]

    _setStorage(keys.ownershipTokenCount, ownershipTokenCount)
    _setStorage(keys.tokenIndexToOwner, tokenIndexToOwner)
    _setStorage(keys.tokenIndexToApproved, tokenIndexToApproved)
  }
// ================== eof: internal function ==============

  /**
   * 创建一个token
   * @param       {number} _matronId   [女人]
   * @param       {number} _sireId     [男人]
   * @param       {number} _generation [代数：第几代]
   * @param       {number} _genes      [基因]
   * @param       {string} _owner      [拥有者]
   *
   * @return      {number}             [tokenId]
   */
  function _createToken (_owner) {
    const _token = {
      birthTime: blockTimestamp
    }
    const tokens = _getStorage(keys.tokens)
    const newTokenId = tokens.push(_token) - 1
    _setStorage(keys.tokens, tokens)

    _transfer(sender, _owner, newTokenId)
    return newTokenId
  }

// ******************************************************************
// ERC721需要实现的函数
// ******************************************************************

  /**
   * 发行的token总数
   * @return {number} [token总数]
   */
  function totalSupply () {
    const tokens = _getStorage(keys.tokens)
    return tokens.length
  }

  /**
   * _owner 有多少个token
   * @param  {string} _owner [所有这地址]
   * @return {number}        [description]
   */
  function balanceOf (_owner) {
    _isAddress('balanceOf', '_owner', _owner)
    const ownershipTokenCount = _getStorage(keys.ownershipTokenCount)
    return ownershipTokenCount[_owner] || 0
  }

  /**
   * 获取 _tokenId 的所有者地址
   * @param  {number} _tokenId [tokenId]
   * @return {string}
   */
  function ownerOf (_tokenId) {
    _isTokenId('_tokenId', _tokenId)
    const tokenIndexToOwner = _getStorage(keys.tokenIndexToOwner)
    return tokenIndexToOwner[_tokenId] || ''
  }

  /**
   * 批准地址_to具有转移_tokenId的能力，即：
   * 批准地址_to可以通过transferFrom转移_tokenId
   * @param  {string} _to      [待批准者的地址]
   * @param  {number} _tokenId [tokenId]
   * @return {boolean}          [是否批准]
   */
  function approve (_to, _tokenId) {
    _isAddress('approve', '_to', _to)
    _isTokenId('_tokenId', _tokenId)
    // Only an owner can grant transfer approval.
    assert(_owns(sender, _tokenId), 'only an owner can grant transfer approval')
    // Register the approval (replacing any previous approval).
    _approve(_tokenId, _to)
  }

  /**
   * 转移_tokenId给_to
   * @param  {string} _to      [地址]
   * @param  {number} _tokenId [tokenId]
   * @return {boolean}          [是否转移成功]
   */
  function transfer (_to, _tokenId) {
    _isAddress('transfer', '_to', _to)
    _isTokenId('_tokenId', _tokenId)
    // 禁止转让给本合约以防止意外滥用，合约账户永远不应该拥有小猫
    assert(_to !== thisAddress, '_to argument cannot be equal to the contract account address')
    // You can only send your own cat.
    assert(_owns(sender, _tokenId), `${sender} can only send your own cat`)
    // Reassign ownership, clear pending approvals, emit Transfer event.
    _transfer(sender, _to, _tokenId)
  }

  /**
   * 从_from转移_tokenId到_to
   * @param  {string} _from    [地址]
   * @param  {string} _to      [地址]
   * @param  {number} _tokenId [tokenId]
   * @return {boolean}          [是否转移成功]
   */
  function transferFrom (_from, _to, _tokenId) {
    // 禁止转让给本合约以防止意外滥用，合约账户永远不应该拥有小猫
    assert(_to !== thisAddress, '_to argument cannot be equal to the contract account address')
    // Check for approval and valid ownership
    // 检查批准和有效所有权
    // 只有所有者和被授权的账户才能进行转移
    assert(_approvedFor(sender, _tokenId), `${sender} not approved`)
    assert(_owns(_from, _tokenId), '')

    // Reassign ownership (also clears pending approvals and emits Transfer event).
    _transfer(_from, _to, _tokenId)
  }

// Optional
  function name () {
    return _getStorage(keys.name)
  }

  function symbol () {
    return _getStorage(keys.symbol)
  }

  /**
   * 返回地址_owner的所有token
   * @param _owner
   */
  function tokensOfOwner (_owner) {
    const tokenIndexToOwner = _getStorage(keys.tokenIndexToOwner)
    let tokenIds = tokenIndexToOwner.keys()
    tokenIds = tokenIds.filter(function (tokenId) {
      if (tokenIndexToOwner[tokenId] === _owner) {
        return tokenId
      }
    })
    return tokenIds
  }

  function createToken (owner) {
    return _createToken(owner)
  }

  function init (arg) {
    const data = JSON.parse(arg)
    _setStorage(keys.name, data.name)
    _setStorage(keys.symbol, data.symbol)
    // 存储智能合约产生的所有token
    _setStorage(keys.tokens, [])
    // tokenId到拥有者的映射 {tokenId: address}
    _setStorage(keys.tokenIndexToOwner, {})
    // token拥有者到token数量的映射 {address: count}
    _setStorage(keys.ownershipTokenCount, {})
    // 批准address通过transferFrom转移tokenId的映射 {tokenId: address}
    _setStorage(keys.tokenIndexToApproved, {})
  }

  function main (arg) {
    const data = JSON.parse(arg)
    const operation = data.operation || ''
    const param = data.param || {}
    let result = null

    switch (operation) {
      case 'createToken':
        result = createToken(param.owner)
        break
      case 'approve':
        result = approve(param.to, param.tokenId)
        break
      case 'transfer':
        result = transfer(param.to, param.tokenId)
        break
      case 'transferFrom':
        result = transferFrom(param.from, param.to, param.tokenId)
        break
      default:
        result = 'The main interface does not support this operation.'
    }

    return JSON.stringify(result)
  }

  function query (arg) {
    const data = JSON.parse(arg)
    const operation = data.operation || ''
    const param = data.param || {}
    let result = null

    switch (operation) {
      case 'name':
        result = name()
        break
      case 'symbol':
        result = symbol()
        break
      case 'totalSupply':
        result = totalSupply()
        break
      case 'balanceOf':
        result = balanceOf(param.tokenId)
        break
      case 'ownerOf':
        result = ownerOf(param.tokenId)
        break
      case 'tokensOfOwner':
        result = symbol()
        break
      default:
        result = 'The query interface does not support this operation.'
    }

    return JSON.stringify({
      result: result,
      tokens: _getStorage(keys.tokens),
      tokenIndexToOwner: _getStorage(keys.tokenIndexToOwner),
      ownershipTokenCount: _getStorage(keys.ownershipTokenCount),
      tokenIndexToApproved: _getStorage(keys.tokenIndexToApproved)
    })
  }
  // Reassign ownership (also clears pending approvals and emits Transfer event).
  _transfer(_from, _to, _tokenId)
}

// Optional
function name () {
  return _getStorage(keys.name)
}

function symbol () {
  return _getStorage(keys.symbol)
}

/**
 * 返回地址_owner的所有token
 * @param _owner
 */
function tokensOfOwner (_owner) {
  const tokenIndexToOwner = _getStorage(keys.tokenIndexToOwner)
  let tokenIds = tokenIndexToOwner.keys()
  tokenIds = tokenIds.filter(function (tokenId) {
    if (tokenIndexToOwner[tokenId] === _owner) {
      return tokenId
    }
  })
  return tokenIds
}

function createToken (owner) {
  return _createToken(owner)
}

function init (arg) {
  const data = JSON.parse(arg)
  _setStorage(keys.name, data.name)
  _setStorage(keys.symbol, data.symbol)
  // 存储智能合约产生的所有token
  _setStorage(keys.tokens, [])
  // tokenId到拥有者的映射 {tokenId: address}
  _setStorage(keys.tokenIndexToOwner, {})
  // token拥有者到token数量的映射 {address: count}
  _setStorage(keys.ownershipTokenCount, {})
  // 批准address通过transferFrom转移tokenId的映射 {tokenId: address}
  _setStorage(keys.tokenIndexToApproved, {})
}

function main (arg) {
  const data = JSON.parse(arg)
  const operation = data.operation || ''
  const param = data.param || {}
  let result = null

  switch (operation) {
    case 'createToken':
      result = createToken(param.owner)
      break
    case 'approve':
      result = approve(param.to, param.tokenId)
      break
    case 'transfer':
      result = transfer(param.to, param.tokenId)
      break
    case 'transferFrom':
      result = transferFrom(param.from, param.to, param.tokenId)
      break
    default:
      result = 'The main interface does not support this operation.'
  }

  return JSON.stringify(result)
}

function query (arg) {
  const data = JSON.parse(arg)
  const operation = data.operation || ''
  const param = data.param || {}
  let result = null

  switch (operation) {
    case 'name':
      result = name()
      break
    case 'symbol':
      result = symbol()
      break
    case 'totalSupply':
      result = totalSupply()
      break
    case 'balanceOf':
      result = balanceOf(param.tokenId)
      break
    case 'ownerOf':
      result = ownerOf(param.tokenId)
      break
    case 'tokensOfOwner':
      result = symbol()
      break
    default:
      result = 'The query interface does not support this operation.'
  }

  return JSON.stringify({
    result: result,
    tokens: _getStorage(keys.tokens),
    tokenIndexToOwner: _getStorage(keys.tokenIndexToOwner),
    ownershipTokenCount: _getStorage(keys.ownershipTokenCount),
    tokenIndexToApproved: _getStorage(keys.tokenIndexToApproved)
  })
}
