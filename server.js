/*
 * Copyright (C) 2010-2014 by Revolution Analytics Inc.
 *
 * This program is licensed to you under the terms of Version 2.0 of the
 * Apache License. This program is distributed WITHOUT
 * ANY EXPRESS OR IMPLIED WARRANTY, INCLUDING THOSE OF NON-INFRINGEMENT,
 * MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE. Please refer to the
 * Apache License 2.0 (http://www.apache.org/licenses/LICENSE-2.0) for more 
 * details.
 */

var express      = require('express'),
    Primus       = require('primus.io'),
    config       = require('./config/config'), 
    FraudService = require('./server/service/fraud-service'),
    app          = express(),    
    router       = express.Router();

app.use('/', router);
app.use(express.static(__dirname + '/client/app'));

// -- Start Primus server --
var server = require('http').createServer(app);
var primus = new Primus(server, { transformer: 'websockets', parser: 'JSON' });

primus.on('connection', function (spark) {
    var fraudService = new FraudService(primus);
   
    router.get('/fraud/score/:tasks', function(req, res) {    	
    	 var tasks = req.params.tasks === 0 ? 1 : req.params.tasks;
       console.log('REST:/fraud/score/' + tasks + ' called.');

       for(var i = 0; i < tasks; i++) {
          fraudService.submit(fraudService.buildTask());
       }
       
       res.json({ success: true });
    });

    router.post('/fraud/pool/init/:size', function (req, res) {
    	var size = req.params.size === 0 ? 1 : req.params.size;
    	console.log('REST:/pool/init/' + size + ' called.');

    	fraudService.buildPool(size);
      res.json({ success: true });
    });
});

primus.on('disconnection', function () {
  console.log('disconnect...');
});

// -- Start server --
server.listen(config.port, function(){
  console.log('\033[96mlistening on localhost:' + config.port +' \033[39m');
});
