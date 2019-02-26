import {LoggerFactory, LoggerFactoryOptions, LFService, LogGroupRule, LogLevel} from "typescript-logging";

// TODO: add support to change the log level via a env var
const options = new LoggerFactoryOptions()
    .addLogGroupRule(new LogGroupRule(new RegExp(".+"), LogLevel.Debug));

export const LogFactory = LFService.createNamedLoggerFactory("LoggerFactory", options);