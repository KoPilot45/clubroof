<?php
if (version_compare(PHP_VERSION, "8.1.0", "<")) { http_response_code(500); exit; }
require __DIR__ . "/lib/seo_files.php";
serve_robots();
