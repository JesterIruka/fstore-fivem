/**
 * everything is injected using global scope
 */
const { sql, pluck, insert, getDatatable, setDatatable, createAppointment, after } = global['database'];

const custom = {};

custom.myFunction = (user_id) => {
  // Do whatever you want
}

module.exports = custom;