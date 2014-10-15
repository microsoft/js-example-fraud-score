
### SCORING THE MODEL 
require(RevoScriptTools)
revoInput('{"name": "bal", "render":"integer", "default": 5000, "min" : 0, "max": 25000 }')
revoInput('{"name": "trans", "render":"integer", "default": 12, "min" : 0, "max": 100 }')
revoInput('{"name": "credit", "render":"integer", "default": 8, "min" : 0, "max": 75 }')

if(!exists('fraudModel')){load('fraudModel.rData')}
score<-data.frame(balance=bal,numTrans=trans,creditLine=credit)
x<-predict(fraudModel, score)
