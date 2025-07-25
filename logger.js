const AWS = require('aws-sdk');
AWS.config.update({
    accessKeyId: process.env.ACCESS_KEY_ID,
    secretAccessKey: process.env.SECRET_ACCESS_KEY,
    region: process.env.REGION,
    sessionToken: process.env.SESSION_TOKEN,
});

const cloudwatchlogs = new AWS.CloudWatchLogs();

const LOG_GROUP_NAME = process.env.LOG_GROUP_NAME;  //Nome do Log Group
const LOG_STREAM_NAME = process.env.LOG_STREAM_NAME;  //Nome do Log Stream

let sequenceToken = null;

//Garante que grupo e stream existem
async function ensureCloudWatchSetup() {
    try {
        const groups = await cloudwatchlogs.describeLogGroups({ logGroupNamePrefix: LOG_GROUP_NAME }).promise();
        if (!groups.logGroups.find(g => g.logGroupName === LOG_GROUP_NAME)) {
            await cloudwatchlogs.createLogGroup({ logGroupName: LOG_GROUP_NAME }).promise();
        }

        const streams = await cloudwatchlogs.describeLogStreams({
            logGroupName: LOG_GROUP_NAME,                                                                                               
            logStreamNamePrefix: LOG_STREAM_NAME,
        }).promise();

        if (streams.logStreams.length === 0) {
            await cloudwatchlogs.createLogStream({ logGroupName: LOG_GROUP_NAME, logStreamName: LOG_STREAM_NAME }).promise();
        } else {
            sequenceToken = streams.logStreams[0].uploadSequenceToken;
        }
    } catch (err) {
        console.error('Erro ao configurar CloudWatch:', err);
    }
}

ensureCloudWatchSetup();

// Enviar log para o CloudWatch
async function enviarLogCloudWatch(message) {
    console.log('Enviando log ' + new Date().toISOString());
    const params = {
        logEvents: [
            {
                message: JSON.stringify(message),
                timestamp: Date.now(),
            },
        ],
        logGroupName: LOG_GROUP_NAME,
        logStreamName: LOG_STREAM_NAME,
        sequenceToken,
    };

    try {
        const response = await cloudwatchlogs.putLogEvents(params).promise();
        sequenceToken = response.nextSequenceToken;
        console.log('Log enviado com sucesso ' + new Date().toISOString());
    } catch (err) {
        console.error('Erro ao enviar log:', err);
    }
}

//Logar informação - FIXED: Handle null/undefined req
async function logInfo(message, req, extra = {}) {
    // Use optional chaining and provide fallback for system logs
    const url = req?.originalUrl || 'system-startup';
    const log = gerarLog('info', message, url, extra);

    await enviarLogCloudWatch(log);
}

//Logar erro - FIXED: Handle null/undefined req
async function logError(message, req, error = {}, extra = {}) {
    // Use optional chaining and provide fallback for system logs
    const url = req?.originalUrl || 'system-startup';
    let log = gerarLog('error', message, url, extra);
    if (error) {
        log.error = {error}
    }

    await enviarLogCloudWatch(log);
}

function gerarLog(level, message, rota, extra) {
    return {
        level: level,
        message,
        route: rota,
        timestamp: new Date().toISOString(), // Added timestamp for better logging
        ...extra,
    };
}

module.exports = { logInfo, logError };