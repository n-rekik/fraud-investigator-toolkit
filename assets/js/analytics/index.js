// The list of tests shown in the toolkit, in menu order.
// To add a test: create a file in this folder (copy docs/new-test-template.js),
// import it below and add it to the list. See docs/adding-a-test.md.

import benford from './benford.js';
import duplicatePayments from './duplicate-payments.js';
import vendorEmployee from './vendor-employee.js';
import journalEntries from './journal-entries.js';

export default [duplicatePayments, vendorEmployee, journalEntries, benford];
