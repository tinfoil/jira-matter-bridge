var express = require('express');
var router = express.Router();
var https = require('https');
var http = require('http');
var toMarkdown = require('to-markdown');
var url = require('url');
var HttpsProxyAgent = require('https-proxy-agent');
var HttpProxyAgent = require('http-proxy-agent');

function toTitleCase(str) {
    return str.replace(/\w\S*/g, function(txt) {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
}

function summarizeString(str, length) {
    var out = str;
    if (str.length > length) {
        out = str.slice(0,length) + "\\[..\\]";
    }

    return out;
}

function toTable(items) {
    const toTableEntry = (fieldName, fieldValue) =>
        "| " + toTitleCase(toMarkdown(fieldName)) + " | " + toMarkdown(fieldValue) + " |";

    var tableData = items.map(item => {
        var fieldName = item.field;
        var fieldValue = item.toString();
        if (fieldValue) {
            fieldValue = summarizeString(fieldValue, 20);
        }
        if(!fieldValue){
            fieldValue = "-Cleared-";
        }
        return toTableEntry(fieldName, fieldValue);
    });

    tableData.unshift("| Field | Updated Value |\r\n|:----- |:-------------|");

    return tableData.join("\r\n");
}

function summarizeIssue(issue) {
    let fields = issue.fields;
    let issuetype = fields.issuetype;
    let name = issuetype.name;

    var desc = fields.description || "";
    desc = summarizeString(desc, 140);
    if (desc.length > 0) {
        desc = "\r\n\r\n" + desc;
    }

    return `Type: __${name}__${desc}`;
}

function postToServer(postContent, hookid, matterUrl) {
    console.log("Informing mattermost channel: " + hookid);
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "1";

    var agent, httpsagent, httpagent = null;
    var https_proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
    var http_proxy = process.env.HTTP_PROXY || process.env.http_proxy;
    if(https_proxy)
    {
        httpsagent = new HttpsProxyAgent(https_proxy);
        console.log("Using HTTPS proxy - " + https_proxy);
    }
    if(http_proxy)
    {
        httpagent = new HttpProxyAgent(http_proxy);
        console.log("Using HTTP proxy - " + http_proxy);
    }

    var matterServer = process.env.MATTERMOST_SERVER || 'localhost';
    var matterServerPort = process.env.MATTERMOST_SERVER_PORT;
    var matterProto = process.env.MATTERMOST_SERVER_PROTO || 'http';
    var matterPath = (process.env.MATTERMOST_SERVER_PATH || '/hooks/') + hookid;
    var matterUsername = process.env.MATTERMOST_USERNAME || 'JIRA';
    var matterIconUrl = process.env.MATTERMOST_ICON_URL || 'https://design.atlassian.com/images/logo/favicon.png';

    if(matterUrl)
    {
        try
        {
            var murl = url.parse(matterUrl);
            matterServer = murl.hostname || matterServer;
            matterServerPort = murl.port || matterServerPort;
            matterProto = murl.protocol.replace(":","") || matterProto;
            matterPath = murl.pathname || matterPath;
        }
        catch(err){console.log(err)}
    }
    //If the port is not initialized yet (neither from env, nor from query param)
    // use the defaults ports
    if(!matterServerPort)
    {
        if (matterProto == 'https')
        {
            matterServerPort = '443';
        }
        else
        {
            matterServerPort = '80';
        }
    }
    console.log(matterServer + "-" + matterServerPort  + "-" + matterProto);

    var proto;
    if(matterProto == 'https')
    {
        console.log("Using https protocol");
        proto = https;
        agent = httpsagent;
    }
    else
    {
        console.log("Using http protocol");
        proto = http;
        agent = httpagent;
    }

    console.log("POST DATA");
    console.log(postData);

    var postData;
    try {
        postData = JSON.stringify({
            "text": postContent,
            "username": matterUsername,
            "icon_url": matterIconUrl
        });
    } catch(e) {
        console.log("Malformed postContent - " + e);
        return;
    }

    var post_options = {
        host: matterServer,
        port: matterServerPort,
        path: matterPath,
        method: 'POST',
        agent: agent,
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    try
    {
        // Set up the request
        var post_req = proto.request(post_options, function(res) {
            res.setEncoding('utf8');
            res.on('data', function(chunk) {
                console.log('Response: ' + chunk);
            });
            res.on('error', function(err) {
                console.log('Error: ' + err);
            });
        });

        // post the data
        post_req.write(postData);
        post_req.end();
    }
    catch(err)
    {
        console.log("Unable to reach mattermost server: " + err);
    }
}

router.get('/', function(req, res, next) {
    res.render('index', {
        title: ''
    });
});

router.get('/hooks/:hookid', function(req, res, next) {
    res.render('index', {
        title: ''
    });
});

router.post('/hooks/:hookid', function(req, res, next) {
    console.log("Received update from JIRA");
    const hookId = req.params.hookid;
    const webevent = req.headers['x-webhook-type'] || req.body.webhookEvent;

    if (!req.body.issue) {
        console.log(`Event (type ${webevent}) has no issue. Probably a buggy comment notification from https://jira.atlassian.com/browse/JRASERVER-59980`);
        if (req.body.comment.self) {
            console.log("...comment URL is " + req.body.comment.self);
        }
        return;
    }

    const matterUrl = req.query.matterurl;

    const issueID      = req.body.issue.key;
    const issueRestUrl = req.body.issue.self;
    const issueUrl     = new url.URL(`/browse/${issueID}`, issueRestUrl).toString();
    const summary      = req.body.issue.fields.summary;

    const changeLog = req.body.changelog;
    const comment   = req.body.comment;

    const author = (comment || {}).author;
    const user   = req.body.user || author || {};

    const displayName = user.displayName;
    const avatar      = user.avatarUrls["16x16"];

    var postContent;

    const constructHeader = (action) =>
        `##### ${displayName} ${action} [${issueID}](${issueUrl}): ${summary}`;

    if (webevent === "jira:issue_updated")
    {
        postContent = constructHeader('updated');
    }
    else if(webevent === "jira:issue_created")
    {
        postContent = constructHeader('created');
        postContent += "\r\n" + summarizeIssue(req.body.issue)
    }
    else if(webevent === "jira:issue_deleted")
    {
        postContent = constructHeader('deleted');
    }
    else if(webevent === "comment_created")
    {
        postContent = constructHeader('commented on');
    }
    else
    {
        console.log("Ignoring events which we don't understand");
        return;
    }

    if(changeLog)
    {
        let changedItems = req.body.changelog.items;
        let tableData = toTable(changedItems);

        postContent += `\r\n${tableData}`;
    }

    if(comment)
    {
        let commentData = summarizeString(comment.body, 300);
        postContent += "\r\n##### Comment:\r\n" + toMarkdown(commentData);
    }

    postToServer(postContent, hookId, matterUrl);

    res.render('index', {
        title: ''
    });
});


module.exports = router;
