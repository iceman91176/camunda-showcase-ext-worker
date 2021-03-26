const {
  Client,
  KeycloakAuthInterceptor,
  logger
} = require("camunda-external-task-client-js");
const got = require("got");

require('dotenv').config();



const mailService = require('./mail.js');
const esService = require('./elastic-index.js')

let second = 1000;
let minute = 60 * second;

const config = {
  baseUrl: process.env.CAMUNDA_REST_BASE_URL,
  workerId: process.env.WORKER_ID,
  asyncResponseTimeout: 5 * second,
  interval: 1 * second,
  lockDuration: 10 * second,
  use: logger,
  autoPoll: false
};

if (process.env.KEYCLOAK_AUTH_ENABLED){
    const keycloakAuthentication = new KeycloakAuthInterceptor({
    tokenEndpoint: process.env.KEYCLOAK_TOKEN_URL,
    clientId: process.env.KEYCLOAK_CLIENT,
    clientSecret: process.env.KEYCLOAK_CLIENT_SECRET
    });
    config.interceptors=keycloakAuthentication;
}


const client = new Client(config);

client.on('poll:error', (err) => console.log(`The error is:  ${err}`));

var esServiceHandler = async (task, taskService) => {

    //get all relevant variables
    let application=task.variables.get("application");
    let keyAccount=task.variables.get("keyAccount");
    let riskAssessment=task.variables.get("riskAssessment");
    let produkt=task.variables.get("produkt");
    let checkResult=task.variables.get("checkResult");
    /*
    console.log(application);
    console.log(keyAccount);
    console.log(riskAssessment);
    console.log(produkt);
    console.log(checkResult);
    */

    let doc={};

    if (checkResult=="approve"){
        //create es document
        doc = {
            "produkt": produkt,
            "customer_full_name": application.applicant.name,
            "customer_email": application.applicant.email,
            "application_date": Date.now(),
            "application_request_id": task.businessKey,
            "application_status": "approved",
            "application_number": application.applicationNumber,
            "risk_level": riskAssessment.riskLevel,
            "application_premium": application.premium,
            "key_account": keyAccount.name
        }
    } else {
        doc = {
            "produkt": produkt,
            "customer_full_name": application.applicant.name,
            "customer_email": application.applicant.email,
            "application_date": Date.now(),
            "application_request_id": task.businessKey,
            "application_status": "declined",
            "risk_level": riskAssessment.riskLevel,
            "key_account": keyAccount.name
        }

    }
    //console.log(doc);

    esService.indexDocument(process.env.ES_INDEX,doc)
    .then(async () => await taskService.complete(task))
    .catch(async (err) => {
      console.log(err);
      await taskService.handleFailure(task, {
        errorMessage: err.message,
        errorDetails: err.stack,
        retries: 0,
        retryTimeout: 1000
      });
    });

    //build es-doc

}

var emailServicehandler = async (task, taskService) => {
  // get the process variable 'score'
  let application=task.variables.get("application");
  //console.log(application);
  //let application = JSON.parse(task.variables.get("application"));
  let mailtext = task.variables.get("mailBody");
  let subject = task.variables.get("mailSubject");
  //Todo : get from task variable
  let email = application.applicant.email;
  //console.log(mailtext);
  //console.log(subject);

  mailService.sendMail(subject, mailtext, email)
  .then(async () => await taskService.complete(task))
  .catch(async (err) => {
      console.log(err);
      await taskService.handleFailure(task, {
        errorMessage: err.message,
        errorDetails: err.stack,
        retries: 0,
        retryTimeout: 1000
      });
    });
}

client.start();
client.subscribe("sendMail", async ({task, taskService}) => {
  emailServicehandler(task, taskService);
  await taskService.extendLock(task, 20 * second);
});

client.subscribe("controllingReport", async ({task, taskService}) => {
  esServiceHandler(task, taskService);
  await taskService.extendLock(task, 20 * second);
});
