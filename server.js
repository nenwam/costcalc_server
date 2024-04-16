const express = require('express');
const bodyParser = require('body-parser');
// const { Server } = require("socket.io");
const http = require('http');
const cors = require('cors');
const mondaySdk = require('monday-sdk-js');
// import mondaySdk from "monday-sdk-js";

const app = express();
const port = 3001; // Use your preferred port
const server = http.createServer(app);
const monday = mondaySdk();
monday.setToken('eyJhbGciOiJIUzI1NiJ9.eyJ0aWQiOjI5MTI1MjEwNSwiYWFpIjoxMSwidWlkIjo1MDY1MzM4MSwiaWFkIjoiMjAyMy0xMC0yM1QyMToyNzo1Ni4wMDBaIiwicGVyIjoibWU6d3JpdGUiLCJhY3RpZCI6MTkzNTI3OTYsInJnbiI6InVzZTEifQ.IxSCkDC63caJ9dP_HobxQpVMEWXSJUDi-vcyRozQnKA')
// const io = socketIo(server);
let jobCost = null;

const obtainInputParams = (extractedParams) => {
  // Make vinyl type selection a column type
  console.log("Extracted Params: ", extractedParams)
  const vinylType = extractedParams.filter(param => param.label === 'dropdown__1')[0].value

  const dimensions = extractedParams.filter(param => param.label === 'text')[0].value
  const regex = /\d+/g;
  const dimAsNums = dimensions.match(regex).map(Number);

  const width = dimAsNums[0]
  const height = dimAsNums[1]
  const count = parseInt(extractedParams.filter(param => param.label === 'numbers')[0].value, 10)

  const printSettings = (extractedParams.filter(param => param.label === 'dropdown0')[0].value).split('-')
  const includesWhite = printSettings.includes('WHITE') ? true : false
  const includesGloss = printSettings.includes('GLOSS') ? true : false
  const includesColor = printSettings.includes('CMYK') ? true : false

  const colorPercent = parseFloat(extractedParams.filter(param => param.label === 'numbers8')[0].value)
  const colorPasses = parseInt(extractedParams.filter(param => param.label === 'numbers7')[0].value)
  const whitePercent = parseFloat(extractedParams.filter(param => param.label === 'numbers4')[0].value)
  const whitePasses = parseInt(extractedParams.filter(param => param.label === 'numbers95')[0].value)
  const glossPercent = parseFloat(extractedParams.filter(param => param.label === 'numbers82')[0].value)
  const glossPasses = parseInt(extractedParams.filter(param => param.label === 'numbers6')[0].value)

  const targetCost = parseFloat(extractedParams.filter(param => param.label === 'numbers87')[0].value)
  const tax = extractedParams.filter(param => param.label === 'status_1')[0].value === 'Yes' ? true : false
  const commission = extractedParams.filter(param => param.label === 'status_2')[0].value === 'Yes' ? true : false

  console.log("Print Settings: ", printSettings)
  // const includeColor = extractedParams.filter(param => param.label === 'dropdown0')[0].value

  

  const params = {
    vinylType: vinylType,
    width: width,
    height: height,
    count: count,
    includeColor: includesColor,
    colorPercent: colorPercent,
    colorPasses: colorPasses,
    includeWhite: includesWhite,
    whitePercent: whitePercent,
    whitePasses: whitePasses,
    includeGloss: includesGloss,
    glossPercent: glossPercent,
    glossPasses: glossPasses,
    targetCostPerPrint: targetCost,
    bSalesTax: tax,
    bSalesCommission: commission
  }
  
  return params
}

const getJobCost = async (params, webhook) => {
  const jobCostData = null
  try {

    const headers = {
      // Uncomment or edit according to the header you need to set
      // 'Origin': 'http://your-origin.com',
      'X-Requested-With': 'XMLHttpRequest',
      // Add other headers as needed
    };

      // Second API call to get job cost
      const jobCostUrl = `https://api.stickermania818.com/jobcost?vinylType=${params.vinylType}&width=${params.width}&height=${params.height}&count=${params.count}&includeColor=${params.includeColor}&colorPercent=${params.colorPercent}&colorPasses=${params.colorPasses}&includeWhite=${params.includeWhite}&whitePercent=${params.whitePercent}&whitePasses=${params.whitePasses}&includeGloss=${params.includeGloss}&glossPercent=${params.glossPercent}&glossPasses=${params.glossPasses}&targetCostPerPrint=${params.targetCostPerPrint}&bSalesTax=${params.bSalesTax}&bSalesCommission=${params.bSalesCommission}`;
      const jobCostResponse = await fetch(jobCostUrl, {headers});
      if (!jobCostResponse.ok) {
          throw new Error(`Error: ${jobCostResponse.statusText}`);
      }
      const jobCostData = await jobCostResponse.json();
      console.log("Job Cost Data: ", jobCostData)
      // setJobCost(jobCostData);

      const itemId = webhook.event.pulseId;
      const boardId = webhook.event.boardId;

      const modifyQuery = `
        mutation {
          change_multiple_column_values(item_id: ${itemId}, board_id: ${boardId}, column_values: "{\\"numbers1\\": \\"${jobCostData.costOfGoodsPerPrintJob}\\", \\"numbers3\\": \\"${jobCostData.perPrintTotal}\\", \\"numbers11\\": \\"${jobCostData.jobTotal}\\"}") {
            id
            column_values {
              id
              value
            }
          }
        }`
        
      monday.api(modifyQuery).then((res) => {
        console.log("Update res: ", res)
      }).catch((err) => {
        console.log("Error updating columns: ", err)
      })
  } catch (error) {
      console.error('Error fetching data:', error);
  }
  
  return jobCostData
}

// Sales commission is double
// 

const calculate = (fromWebhook) => {
  console.log("hello")

  if (fromWebhook.event !== undefined) {
    console.log("From Webhook calculate: ", fromWebhook.event)
    const itemId = fromWebhook.event.pulseId;
    const boardId = fromWebhook.event.boardId;
    

    const query = `query {
      items(ids: ${itemId}) {
        name
        column_values {
          id
          text
          value
        }
      }
    }`;
    monday.api(query).then((res) => {
        console.log("ListInput res: ", res);
        const columns = res.data.items[0].column_values;
        console.log("Columns: ", columns);
        const filter = ['text', ]
        const cols = columns.map(column => {                      
            return {label: column.id, value: column.text}
        })
        console.log("Cols: ", cols)
        const apiParams = obtainInputParams(cols)
        getJobCost(apiParams, fromWebhook)
        console.log("API Params: ", apiParams)
    }).catch((err) => {
        console.log("Error fetching columns: ", err);
    }).finally(() => {
        // setShouldLoad(false)
    });

    
    
  }
}

app.use(bodyParser.json());
app.use(cors());

server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

// const io = new Server(server, {
//   cors: {
//     // Specify the exact client origin
//     origin: "https://c8a22a9bcbe5.ngrok.app",
//     methods: ["GET", "POST"],
//     // credentials: true // allowing credentials
//   }
// });

// io.on('connection', (socket) => {
//   console.log('a user connected');
//   socket.emit('FromAPI', { data: 'Hello from Server!' });
//   console.log('Emitting data to client')
// });

// app.use(cors({
//   origin: 'http://localhost:3000', // Allow only this origin to access
//   methods: ['GET', 'POST'], // Allow only these methods
//   allowedHeaders: ['Content-Type', 'Authorization'], // Allow only these headers
//   credentials: true, // Enable cookies across domains
// }));

app.post('/webhook', (req, res) => {
  if (req.body.challenge) {
    console.log('Received challenge:', req.body.challenge);
    // Respond with the challenge token
    // io.emit('FromAPI', req.body);
    res.json({ challenge: req.body.challenge });
    
  } else {
      // Handle other webhook events
      console.log('Webhook received:', req.body);
      io.emit('FromAPI', req.body);
      console.log('Emitting data from monday: ', req.body)
      calculate(req.body)
      // Your code to handle webhook events goes here
      res.status(200).send('OK');
  }
});

