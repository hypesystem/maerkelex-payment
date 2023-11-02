const orders = require("./maerkelex-orders-20230720.json");
//TODO: auth + load orders.json

console.log("ord", Object.entries(orders[0]));

const theseOrders = orders.filter((o) => {
	const [ _, dateStr, monthStr, yearStr ] = o.date.match(/([0-9]{2})\/([0-9]{2}) ([0-9]{4})/);
	const year = Number(yearStr);
	const month = Number(monthStr);
	return year === 2023 && month < 7;
});

const badgeCountTable = {
        "10-minutters-tårn": "10-min-taarn.jpg",
        "12 x telt": "12-x-telt.jpg",
        "200 km mærket": "200km.jpg",
        "200 km mærket (80 timer)": "200km-hardcore.jpg",
        "36 timer": "36-timer.jpg",
        "Gift med en spejder": "gift-med-en-spejder.jpg",
        "Kystvogter": "kystvogter.jpg",
        "Leder&shy;challenge": "lederchallenge.jpg",
        "Madtropperne": "madtropperne.jpg",
        "Mærkedesigner": "maerkedesigner.jpg",
        "One night stand": "one-night-stand.jpg",
        "Overlevelsestur": "overlevelsestur.jpg",
        "Rollespejd Bronze": "rollespejd-bronze.jpg",
        "Rollespejd Guld": "rollespejd-guld.jpg",
        "Rollespejd Sølv": "rollespejd-soelv.jpg",
        "Skirty": "skirty.jpg",
        "Skirty365": "skirty365.jpg",
        "Skovskider": "skovskider.jpg",
        "Sleep-over": "sleep-over.jpg",
        "Sovepose&#173;365": "sovepose365.jpg",
        "Spejd&#173;365": "spejd365.jpg",
        "St. Georgsdag": "st-george.jpg",
        "Voer&shy;lade&shy;gård Hjemme&shy;spejd": "voerladegaard-hjemmespejd.jpg",

    };
    Object.keys(badgeCountTable).forEach((badgeName) => badgeCountTable[badgeName] = 0);

    theseOrders.map((entry) => {
    	Object.keys(badgeCountTable).forEach(badgeName => {
		const match = entry.description.match(new RegExp(`${escapeRegExp(badgeName)} mærke, ([0-9]+) stk.`, "i"));
		if(match) {
			const count = Number(match[1]);
            		badgeCountTable[badgeName] += count;
        	}
    	});
    });

console.log("huh", theseOrders.map((o) => o.date));

console.log("badgecuonta", badgeCountTable);

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
}
