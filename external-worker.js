const {
  Client,
  logger
} = require("camunda-external-task-client-js");
const got = require("got");

require('dotenv').config();

const mailService = require('./mail.js');

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

const client = new Client(config);

client.on('poll:error', (err) => console.log(`The error is:  ${err}`));

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
