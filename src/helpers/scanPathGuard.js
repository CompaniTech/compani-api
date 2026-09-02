exports.SCAN_PATH_REGEX = new RegExp(
  '\\.(php|phtml|cgi|asp|aspx|jsp)$|wp-content|wp-admin|wp-includes|wp-login|xmlrpc\\.php|'
  + 'phpmyadmin|\\.(env|git|aws|ssh)(\\/|$)|\\.htaccess$',
  'i'
);
