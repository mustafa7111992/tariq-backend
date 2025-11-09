// routes/customers.js
const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');

// إحصائيات (قبل :phone حتى ما يتعارض)
router.get('/stats', customerController.getCustomerStats);
router.get('/search', customerController.searchCustomers);

// CRUD operations
router.get('/', customerController.getCustomers);
router.get('/:phone', customerController.getCustomerByPhone);
router.get('/:phone/requests', customerController.getCustomerRequests);
router.patch('/:phone', customerController.updateCustomer);
router.delete('/:phone', customerController.deleteCustomer);

// عداد الطلبات
router.post('/:phone/requests/count', customerController.incrementRequests);

module.exports = router;