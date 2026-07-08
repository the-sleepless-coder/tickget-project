-- Create databases for TickGet services
CREATE DATABASE IF NOT EXISTS tickget CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS ticketing_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Grant privileges (for development only)
GRANT ALL PRIVILEGES ON tickget.* TO 'root'@'%';
GRANT ALL PRIVILEGES ON ticketing_db.* TO 'root'@'%';
FLUSH PRIVILEGES;
