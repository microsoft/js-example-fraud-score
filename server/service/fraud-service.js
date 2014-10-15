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
 
'use strict';

var rbroker = require('rbroker'),
    RIn     = require('deployr').RInput,
    print   = require('../util/rbroker-print-helper'),
    config  = require('../../config/config');    

var FRAUDMSGTOPIC = '/topic/fraud',
    MSG_TYPES = {
      runtime: 'RUNTIMESTATS',
      score: 'FRAUDSCORE',
      error: 'CLIENTALERT'
    };

var round = function(num) {    
    return +(Math.round(num + 'e+2')  + 'e-2');
};

function FraudService(primus) {
   this.primus = primus;
   this.broker = null;
   this.lastAllocatedPoolSize = 0;
   this.brokerConfig = {
      maxConcurrentTaskLimit: 0,
      host: config.host,
      credentials: config.credentials,
      releaseGridResources: true,
      logging: config.logging,
      pool: {
         preloadobjectname: config.constants.FRAUD_MODEL,
         preloadobjectauthor: config.constants.REPO_OWNER,
         preloadobjectdirectory: config.constants.REPO_DIRECTORY
      }
   };
}

FraudService.prototype = {

   buildPool: function(poolSize) {
      var self = this;
      this.brokerConfig.maxConcurrentTaskLimit = poolSize;

      if (!this.broker) {
         this.attachBroker();
      } else {
         this.broker.shutdown()
            .then(function() {
               console.log('Pooled: RBroker shutdown `successful`.');
               self.attachBroker();
            }, function() {
               console.log('Pooled: RBroker has shutdown `failure`.');
            });
      }

      this.broadcast(this.runtimeStats());
   },

   buildTask: function(task) {
      var bal    = Math.abs(Math.random() * 25000),
          trans  = Math.abs(Math.random() * 100),
          credit = Math.abs(Math.random() * 75);

      return rbroker.pooledTask({
         filename: config.constants.REPO_SCRIPT,
         directory: config.constants.REPO_DIRECTORY,
         author: config.constants.REPO_OWNER,
         routputs: ['x'],
         rinputs: [RIn.numeric('bal', bal),
            RIn.numeric('trans', trans),
            RIn.numeric('credit', credit)
         ]
      });
   },

   submit: function(task) {
      if (this.broker && task) {
         this.broker.submit(task);
      }
   },

   destroy: function() {
      if (this.broker) {        
        this.broker.shutdown()
            .then(function() {
               console.log('Pooled: RBroker shutdown `successful`.');
               self.attachBroker();
            }, function() {
               console.log('Pooled: RBroker has shutdown `failure`.');
            });
      } 
   },

   /**
    * Push RuntimeStats message over STOMP Web Socket to clients
    * listening on FRAUDMSGTOPIC.
    *
    * @api private
    */
   broadcast: function(message) {
      this.primus.send(FRAUDMSGTOPIC, message);
   },

   /**
    * Attach and listen on a new PooledTaskBroker.
    * @api private
    */
   attachBroker: function() {
      var self = this;

      this.broker = rbroker.pooledTaskBroker(this.brokerConfig)
         .complete(function(rTask, rTaskResult) {
            print.results(rTask, rTaskResult);

            // -- notify successful result --
            self.broadcast(self.buildFraudScore(rTask, rTaskResult));
         })
         .error(function(err) {
            print.error(err);

            // -- notify error --
            self.broadcast({
               msgType: MSG_TYPES.error,
               cause: err,
               msg: 'The RBroker runtime has indicated an unexpected ' +
                  ' runtime error has occured. Cause: ' + err
            });
         })
         .progress(function(stats) {
            print.stats(stats);
            self.broadcast(self.runtimeStats(stats));
         });

      this.lastAllocatedPoolSize = this.broker.maxConcurrency();

      console.log('RBroker pool initialized with ' +
         this.lastAllocatedPoolSize + ' R sessions.');
   },

   /**
    * Private helper methods.
    * @api private
    */
   runtimeStats: function(stats) {   

      var runtime = {
         msgType: MSG_TYPES.runtime,
         requestedPoolSize: this.brokerConfig.maxConcurrentTaskLimit,
         allocatedPoolSize: this.lastAllocatedPoolSize,
         endpoint: this.brokerConfig.host
      };

      if (this.brokerConfig.credentials) {
         runtime.username = this.brokerConfig.credentials.username;
      }

      if (stats) {
         runtime.submittedTasks = stats.totalTasksRun;
         runtime.successfulTasks = stats.totalTasksRunToSuccess;
         runtime.failedTasks = stats.totalTasksRunToFailure;

         runtime.averageCodeExecution = 0;
         runtime.averageServerOverhead = 0;
         runtime.averageNetworkLatency = 0;

         if (stats.totalTasksRunToSuccess > 0) {
            runtime.averageCodeExecution =
               round(stats.totalTimeTasksOnCode / stats.totalTasksRunToSuccess);

            var avgTimeOnServer =
               stats.totalTimeTasksOnServer / stats.totalTasksRunToSuccess;

            runtime.averageServerOverhead =
               round(avgTimeOnServer - runtime.averageCodeExecution);

            var avgTimeOnCall =
               stats.totalTimeTasksOnCall / stats.totalTasksRunToSuccess;

            runtime.averageNetworkLatency =
               round(avgTimeOnCall - avgTimeOnServer);
         }
      }

      return runtime;
   },

   /**
    * Private helper methods.
    * @api private
    */
   buildFraudScore: function(rTask, rTaskResult) {
      var rinputs = rTask.toJSON().rinputs;

      return {
         msgType: MSG_TYPES.score,
         success: rTaskResult ? true : false,
         balance: Math.round(rinputs[0].value),
         transactions: Math.round(rinputs[1].value),
         credit: Math.round(rinputs[2].value),
         score: rTaskResult ? rTaskResult.generatedObjects[0].value : -1
      };
   }

};

module.exports = FraudService;
