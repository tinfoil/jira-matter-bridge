const url = require('url');

const Formatters = require('./formatters');
const EventTypes = require('./eventTypes');

function newField(name, value, short) {
    var result = {};
    result.title = name;
    result.value = value;
    if (short === true) {
        result.short = true;
    } else {
        result.short = false;
    }
    return result;
}

function maybeChangeLog(changelog) {
    if (!changelog) { return []; }

    let changedItems = changelog.items;
    let tableData = Formatters.toTable(changedItems);

    return [
        newField("Field", tableData.fields, true),
        newField("Updated Value", tableData.values, true)
    ];
}

function maybeComment(comment) {
    if (!comment) { return []; }

    let commentData = Formatters.summarizeString(comment.body, 300);
    return newField("Summary", Formatters.toMarkdown(commentData));
}

function maybeIssueData(issue) {
    if (!issue) { return []; }
    let fields = issue.fields
    let name = fields.issuetype.name;

    var out = [ newField("Issue Type", `_${name}_`) ];

    var desc = fields.description || "";
    if (desc.length > 0) {
        out.push(
            newField("Description", Formatters.summarizeString(desc, 140))
        );
    }

    return out;
}

function parseBody(body) {
    if (!body) { throw 'expecting a value for body' }
    const webevent = body.webhookEvent;

    const issue        = body.issue;
    const issueID      = issue.key;
    const issueRestUrl = issue.self;
    const issueUrl     = new url.URL(`/browse/${issueID}`, issueRestUrl).toString();
    const summary      = issue.fields.summary;

    const changeLog = body.changelog;
    const comment   = body.comment;

    const user =
        body.user
            || (comment || {}).author
            || {};

    const displayName = user.displayName;
    const avatar      = user.avatarUrls["16x16"];

    const action = EventTypes.toActionString(webevent);

    var postContent = {};
    var fields = [];
    var attachment = {
        title: `${action} ${issueID}: ${summary}`,
        title_link: issueUrl,
        author_name: displayName,
        author_icon: avatar,
        color:  EventTypes.toColor(webevent)
    };

    if(EventTypes.isIssueCreated(webevent)) {
        fields = fields.concat(maybeIssueData(body.issue));
    }

    fields = fields.concat(
        maybeChangeLog(changeLog),
        maybeComment(comment)
    );

    if (fields.length > 0) {
        attachment.fields = fields;
    }

    postContent.attachments = [attachment];
    return postContent;
}

module.exports = {
    parseBody: parseBody
};
