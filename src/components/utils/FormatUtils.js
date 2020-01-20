export function formatMoney(number_, decimalDigits, decimalSeparator, thousandSeparator) {
    let n = number_,
        c = isNaN(decimalDigits = Math.abs(decimalDigits)) ? 2 : decimalDigits,
        d = decimalSeparator == undefined ? "." : decimalSeparator,
        t = thousandSeparator == undefined ? "," : thousandSeparator,
        s = n < 0 ? "-" : "",
        i = String(parseInt(n = Math.abs(Number(n) || 0).toFixed(c))),
        j = (j = i.length) > 3 ? j % 3 : 0;
    return s + (j ? i.substr(0, j) + t : "") + i.substr(j).replace(/(\d{3})(?=\d)/g, "$1" + t) + (c ? d + Math.abs(n - i).toFixed(c).slice(2) : "");
}