var express = require('express');
var router = express.Router();
var https = require('https');
var http = require('http');
var url = require('url');
var HttpsProxyAgent = require('https-proxy-agent');
var HttpProxyAgent = require('http-proxy-agent');

const Parsers = require('../lib/parsers');
const IssueDebounce = require('../lib/issueDebounce');
const EventTypes = require('../lib/eventTypes');

function postToServer(postContent, hookid, matterUrl) {
    console.log("Informing mattermost channel");
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "1";

    var agent, httpsagent, httpagent;
    var https_proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
    var http_proxy = process.env.HTTP_PROXY || process.env.http_proxy;
    if(https_proxy)
    {
        httpsagent = new HttpsProxyAgent(https_proxy);
        let log_safe = new url.URL(https_proxy).host;
        console.log("Using HTTPS proxy - " + log_safe);
    }
    if(http_proxy) {
        httpagent = new HttpProxyAgent(http_proxy);
        let log_safe = new url.URL(http_proxy).host;
        console.log("Using HTTP proxy - " + log_safe);
    }
    // Prefer https agent over http agent
    agent = httpsagent || httpagent;

    var matterServer = process.env.MATTERMOST_SERVER || 'localhost';
    var matterServerPort = process.env.MATTERMOST_SERVER_PORT;
    var matterProto = process.env.MATTERMOST_SERVER_PROTO || 'https';
    var matterPath = (process.env.MATTERMOST_SERVER_PATH || '/hooks/') + hookid;
    var matterUsername = process.env.MATTERMOST_USERNAME || 'JIRA';
    var matterIconUrl = process.env.MATTERMOST_ICON_URL || 'https://design.atlassian.com/images/logo/favicon.png';

    if(matterUrl)
    {
        try
        {
            let murl = url.parse(matterUrl);

            matterServer     = murl.hostname || matterServer;
            matterServerPort = murl.port || matterServerPort;
            matterProto      = murl.protocol.replace(":","") || matterProto;
            matterPath       = murl.pathname || matterPath;
        }
        catch(err){console.log(err)}
    }
    // If the port is not initialized yet (neither from env, nor from query param)
    // use the defaults ports
    if(!matterServerPort)
    {
        matterServerPort = (matterProto === "http") ? "80" : "443";
    }
    console.log(`${matterServer} - ${matterServerPort} - ${matterProto}`);

    var proto;
    proto = (matterProto === 'http') ? http : https;

    postContent.username = matterUsername;
    postContent.icon_url = matterIconUrl;

    const postData = JSON.stringify(postContent);

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
        var post_req = proto.request(post_options, function(res) {
            res.setEncoding('utf8');
            res.on('data', function(chunk) {
                console.log('Response received');
            });
            res.on('error', function(err) {
                console.log('Error: ' + err);
            });
        });

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
    console.log("Received event from JIRA");
    const hookId = req.params.hookid;
    const webevent = req.body.webhookEvent;
    const matterUrl = req.query.matterurl;

    if (!req.body.issue) {
        console.log(`Event (type ${webevent}) has no issue. Probably a buggy comment notification from https://jira.atlassian.com/browse/JRASERVER-59980`);
        if (req.body.comment.self) {
            console.log("...comment URL is " + req.body.comment.self);
        }
        res.render('index', {title: ''});
        return;
    }

    if (!EventTypes.isEventType(webevent)) {
        console.log("Ignoring events which we don't understand");
        res.render('index', {title: ''});
        return;
    }

    const issueID = req.body.issue.key;
    const changeLog = req.body.changelog;

    // Check cache on issue updates to make sure we don't get spammed
    // if there's a lot of updates in a small amount of time
    if (EventTypes.isIssueUpdated(webevent)) {
        if (IssueDebounce.recentlyUpdated(issueID)) {
            // Always send updates on status transitions, but not others
            if (!IssueDebounce.isStatusTransition(changeLog)) {
                res.render('index', {title: ''});
                return;
            }
        }
    }

    let postContent = Parsers.parseBody(req.body);

    postToServer(postContent, hookId, matterUrl);

    res.render('index', {
        title: ''
    });
});


module.exports = router;
