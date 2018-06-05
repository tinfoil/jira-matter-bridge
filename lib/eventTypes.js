const newEntry = (readable, color) => { return {readable: readable, color: color}; };

const UPDATE_COLOR = process.env.MATTERMOST_UPDATE_COLOR || "#2C99CE";
const CREATED_COLOR = process.env.MATTERMOST_CREATED_COLOR || "#FB9E32";
const DELETED_COLOR = process.env.MATTERMOST_DELETED_COLOR || "#000000";
const COMMENT_COLOR = process.env.MATTERMOST_COMMENT_COLOR || "#930800";

const eventTypes = {
    "jira:issue_updated": newEntry("Updated", UPDATE_COLOR),
    "jira:issue_created": newEntry("Created", CREATED_COLOR),
    "jira:issue_deleted": newEntry("Deleted", DELETED_COLOR),
    "comment_created":    newEntry("Commented on", COMMENT_COLOR)
};

function isEventType(hook) {
    return eventTypes.hasOwnProperty(hook);
}

function toActionString(hook) {
    if (isEventType(hook)) {
        return eventTypes[hook].readable;
    }
    throw "Unexpected event type";
}

function toColor(hook) {
    if (isEventType(hook)) {
        return eventTypes[hook].color;
    }
}

function isIssueUpdated(hook) {
    return hook === "jira:issue_updated";
}

function isIssueCreated(hook) {
    return hook === "jira:issue_created";
}

module.exports = {
    isEventType: isEventType,
    isIssueUpdated: isIssueUpdated,
    isIssueCreated: isIssueCreated,
    toActionString: toActionString,
    toColor: toColor,
};
