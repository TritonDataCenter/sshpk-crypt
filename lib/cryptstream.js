/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Copyright (c) 2019, Joyent, Inc.
 */

var mod_sshpk = require('sshpk');
var mod_stream = require('stream');
var mod_crypto = require('crypto');
var mod_assert = require('assert-plus');
var mod_fsm = require('mooremachine');
var mod_util = require('util');
var mod_jsbn = require('jsbn');

var lib_sshbuf = require('./ssh-buffer');

module.exports = { EncryptStream: EncryptStream };

var MAGIC = 0x006fa70c;

function cipherInfo(cipher) {
	cipher = cipher.toLowerCase();
	var m, info = {};
	if ((m = cipher.match(/^aes-([0-9]+)/))) {
		info.ivLength = 128 / 8;
		info.keyLength = parseInt(m[1], 10) / 8;
	} else {
		console.error('sshpk-crypt: unsupported cipher: ' +
		    cipher);
		process.exit(1);
	}
	return (info);
}

function EncryptStream(opts) {
	mod_assert.object(opts, 'opts');
	mod_assert.ok(mod_sshpk.Key.isKey(opts.pubkey),
	    'opts.pubkey must be an sshpk.Key');
	this.es_pubkey = opts.pubkey;
	this.es_cipher = 'aes-256-ctr';
	this.es_mac = 'sha256';
	this.es_kdf = 'sha512';
	this.es_wroteHeader = false;
	this.setup();
	mod_stream.Transform.call(this);
}
mod_util.inherits(EncryptStream, mod_stream.Transform);

EncryptStream.prototype.setup = function () {
	var buf = new lib_sshbuf.SSHBuffer({});

	buf.writeInt(MAGIC);
	buf.writeInt(1);

	buf.writeBuffer(this.es_pubkey.toBuffer('rfc4253'));
	buf.writeString(this.es_cipher);
	buf.writeString(this.es_mac);
	buf.writeString(this.es_kdf);

	var info = cipherInfo(this.es_cipher);
	this.es_nonce = mod_crypto.randomBytes(16);
	this.es_iv = mod_crypto.randomBytes(info.ivLength);
	this.es_curIv = new mod_jsbn.BigInteger(this.es_iv);

	buf.writeBuffer(this.es_nonce);
	buf.writeBuffer(this.es_iv);

	if (this.es_pubkey.type === 'rsa') {
		var premaster = mod_crypto.randomBytes(32);

		var h = mod_crypto.createHash(this.es_kdf);
		h.update(premaster);
		h.update(this.es_nonce);
		this.es_master = h.digest().slice(0, info.keyLength);

		var chal = mod_crypto.publicEncrypt(
		    this.es_pubkey.toBuffer('pkcs8'),
		    premaster);
		buf.writeBuffer(chal);
	} else if (['dsa', 'ecdsa', 'curve25519'].
	    indexOf(this.es_pubkey.type) !== -1) {
		var dh = this.es_pubkey.createDH();
		var ephemeral = dh.generateKeys();

		var secret = dh.computeSecret(this.es_pubkey);

		var h = mod_crypto.createHash(this.es_kdf);
		h.update(secret);
		h.update(this.es_nonce);
		this.es_master = h.digest().slice(0, info.keyLength);

		buf.writeBuffer(ephemeral.toPublic().toBuffer('rfc4253'));
	} else {
		throw (new Error('unsupported key type: ' +
		    this.es_pubkey.type));
	}

	this.es_header = buf.toBuffer();
};

EncryptStream.prototype._transform = function (chunk, enc, done) {
	if (!this.es_wroteHeader) {
		this.push(this.es_header);
		this.es_wroteHeader = true;
	}

	var buf = new lib_sshbuf.SSHBuffer({});

	var info = cipherInfo(this.es_cipher);
	
	this.es_curIv = this.es_curIv.add(mod_jsbn.BigInteger.ONE);
	var iv = new Buffer(this.es_curIv.toByteArray());
	iv = iv.slice(0, info.ivLength);

	var enc = mod_crypto.createCipheriv(this.es_cipher, this.es_master, iv);
	var data = Buffer.concat([enc.update(chunk), enc.final()]);
	buf.writeBuffer(data);

	var hash = mod_crypto.createHmac(this.es_mac, this.es_master);
	hash.update(data);
	buf.writeBuffer(hash.digest());

	this.push(buf.toBuffer());
	done();
};

function DecryptStream(opts) {
	mod_assert.object(opts, 'opts');
	this.ds_emitted = false;
	mod_stream.Transform.call(this);
}
mod_util.inherits(DecryptStream, mod_stream.Transform);

DecryptStream.prototype.

DecryptStream.prototype._transform = function (chunk, enc, done) {
};
