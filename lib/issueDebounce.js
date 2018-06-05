const NodeCache = require('node-cache');

const stdTTL = process.env.MATTERMOST_ISSUE_DEBOUNCE_TIME || 240;
const cacheCheckPeriod = process.env.MATTERMOST_DEBOUNCE_REFRESH_TIMEOUT || 60;

const recentUpdates = new NodeCache({
    stdTTL: stdTTL,
    checkperiod: cacheCheckPeriod
});

function recentlyUpdated(issueID) {
    if (recentUpdates.get(issueID)) {
        recentUpdates.ttl(issueID, stdTTL);
        return true;
    }
    recentUpdates.set(issueID, true);
    return false;
}

function isStatusTransition(changelog) {
    if (!changelog) { return false; }
    if (!changelog.items) { return false; }

    var items = changelog.items;

    if (Array.isArray(items)) {
        let states = items.filter(t => t.field === "status" || t.field === "resolution");
        return states.length > 0;
    }
    return false;
}

module.exports = {
    recentlyUpdated: recentlyUpdated,
    isStatusTransition: isStatusTransition
};
