def emailAlert()
{
var twoWeeksFromToday = new Date();
twoWeeksFromToday.setDate(twoWeeksFromToday.getDate() + 27);
var twoWeeksMonth = twoWeeksFromToday.getMonth() + 1;
var twoWeeksDay = twoWeeksFromToday.getDate();
var twoWeeksYear = twoWeeksFromToday.getFullYear();

var newToday = new Date();
var oneMonthFromToday = new Date(newToday.setMonth(newToday.getMonth()+1))
var oneMonthMonth = oneMonthFromToday.getMonth() + 1
var oneMonthDay = oneMonthFromToday.getDate()
var oneMonthYear = oneMonthFromToday.getFullYear()

var ss = SpreadsheetApp.getActiveSpreadsheet()
var sheet = ss.getSheetByName("dash")
var startRow = 3; # First row of data to process
var numRows = 4; # Number of rows to process

var dataRange = sheet.getRange(startRow, 24, numRows, 41)
var data = dataRange.getValues()


for var i = 0; i < data.length; ++i:
 var row = data[i]

var expireDateFormat = Utilities.formatDate(
   new Date(row[13]),
   'ET',
   'dd/MM/yyyy'
   )

var expireDateMonth = new Date(row[13]).getMonth() + 1
var expireDateDay = new Date(row[13]).getDate()
var expireDateYear = new Date(row[13]).getFullYear()



Logger.log('2 weeks month, expire month' + twoWeeksMonth + expireDateMonth)
if
  expireDateMonth is twoWeeksMonth &&
  expireDateDay is twoWeeksDay &&
  expireDateYear is twoWeeksYear
:
  var subject =
    row[11] + # Status
    '\n' +
    ' - ' +
    '\n' +
    row[0] + # Address
    '\n' +
    ' - ' +
    '\n' +
    'Did we get a response ?  '

  MailApp.sendEmail('hello@gmail.com', subject, message)
  Logger.log('2 weeks from now')


//checking for expiry date 1 month from now
if
  expireDateMonth is oneMonthMonth &&
  expireDateDay is oneMonthDay &&
  expireDateYear is oneMonthYear
)  {
  var subject =
   row[11] + # Status
    '\n' +
    ' - ' +
    '\n' +
    row[0] + # Address
    '\n' +
    ' - ' +
    '\n' +
    'CONTRACT ENDING '

  MailApp.sendEmail('hello@gmail.com', subject, message)
  Logger.log('1 month from now')
}
}
