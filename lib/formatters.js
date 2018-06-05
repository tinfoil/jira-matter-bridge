const toMarkdown = require('to-markdown');

function toTable(items) {
    var fields = [], values = [];
    var tableData = {};

    items.forEach(item => {
        var fieldName = item.field;
        var fieldValue = item.toString;
        if (fieldValue) {
            fieldValue = summarizeString(fieldValue, 20);
        }
        if(!fieldValue){
            fieldValue = "-Cleared-";
        }
        fields.push(fieldName);
        values.push(fieldValue);
    })

    return {
        fields: fields.join("\n"),
        values: values.join("\n")
    };
}

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

module.exports = {
    toMarkdown: toMarkdown,
    toTable: toTable,
    toTitleCase: toTitleCase,
    summarizeString: summarizeString
};
