const hypercore = require('hypercore');
global.chain = require('steem');
chain.api.setOptions({ url: 'https://api.steem.fans', rebranded_api:true });
require('dotenv').config()
global.dchain = require('dsteem');
global.client = new dchain.Client('https://api.steem.fans');
global.k = dchain.PrivateKey.fromString(process.env.K);
global.dollar = 'sbd';

global.vest = 'steem';
