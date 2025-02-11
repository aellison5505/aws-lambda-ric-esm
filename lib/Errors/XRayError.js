/** Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved. */
"use strict";
import { isError } from "./index.js";
/**
 * prepare an exception blob for sending to AWS X-Ray
 * transform an Error, or Error-like, into an exception parseable by X-Ray's service.
 *  {
 *      "name": "CustomException",
 *      "message": "Something bad happend!",
 *      "stack": [
 *          "exports.handler (/var/function/node_modules/event_invoke.js:3:502)
 *      ]
 *  }
 * =>
 *  {
 *       "working_directory": "/var/function",
 *       "exceptions": [
 *           {
 *               "type": "CustomException",
 *               "message": "Something bad happend!",
 *               "stack": [
 *                   {
 *                       "path": "/var/function/event_invoke.js",
 *                       "line": 502,
 *                       "label": "exports.throw_custom_exception"
 *                   }
 *               ]
 *           }
 *       ],
 *       "paths": [
 *           "/var/function/event_invoke.js"
 *       ]
 *  }
 */
export const toFormatted = (err) => {
    if (!isError(err)) {
        return "";
    }
    try {
        return JSON.stringify(new XRayFormattedCause(err));
    }
    catch (error) {
        return "";
    }
};
class XRayFormattedCause {
    working_directory;
    exceptions;
    paths;
    constructor(err) {
        this.working_directory = process.cwd(); // eslint-disable-line
        const stack = [];
        if (err.stack) {
            const stackLines = err.stack.split("\n");
            stackLines.shift();
            stackLines.forEach((stackLine) => {
                let line = stackLine.trim().replace(/\(|\)/g, "");
                line = line.substring(line.indexOf(" ") + 1);
                const label = line.lastIndexOf(" ") >= 0
                    ? line.slice(0, line.lastIndexOf(" "))
                    : null;
                const path = label == undefined || label == null || label.length === 0
                    ? line
                    : line.slice(line.lastIndexOf(" ") + 1);
                const pathParts = path.split(":");
                const entry = {
                    path: pathParts[0],
                    line: parseInt(pathParts[1]),
                    label: label || "anonymous",
                };
                stack.push(entry);
            });
        }
        this.exceptions = [
            {
                type: err.name,
                message: err.message,
                stack: stack,
            },
        ];
        const paths = new Set();
        stack.forEach((entry) => {
            paths.add(entry.path);
        });
        this.paths = Array.from(paths);
    }
}
