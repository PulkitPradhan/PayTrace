const dotenv = require('dotenv');
dotenv.config();

const { getJwtSecret } = require('./middleware/auth');

// Fail closed at startup if JWT_SECRET is missing, short, or blacklisted
getJwtSecret();

const app = require('./app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('===============================================================');
  console.log(`PAYTRACE SERVER RUNNING ON http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('Database Host:', process.env.DB_HOST || '127.0.0.1');
  console.log('===============================================================');
});
