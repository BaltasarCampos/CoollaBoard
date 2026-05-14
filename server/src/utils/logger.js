function log(level, fields = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    ...fields,
  };
  process.stdout.write(JSON.stringify(entry) + '\n');
}

const logger = {
  info:  (fields) => log('info',  fields),
  warn:  (fields) => log('warn',  fields),
  error: (fields) => log('error', fields),
  debug: (fields) => log('debug', fields),
};

export default logger;
