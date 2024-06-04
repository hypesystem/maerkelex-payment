export default (db, maerkelex) => {
    ensureStockDbExists(db);

    return {
        saveState: (state) => saveStockState(db, state),
        loadState: () => loadStockState(db, maerkelex),
        getBadgeCosts: (badgeId) => getBadgeCosts(db, badgeId),
        reduceStockForBadge: (badgeId, count) => reduceStockForBadge(db, badgeId, count),
    };
};

async function ensureStockDbExists(db) {
    await db.query("CREATE TABLE IF NOT EXISTS stock (badge_id varchar(400) NOT NULL, count integer NOT NULL, production_cost integer NOT NULL, license_cost integer NOT NULL)", (error) => {
        if(error) {
            console.error("Failed to ensure stock database. May see erratic behaviour.", error);
        }
    });
}

async function saveStockState(db, state) {
    const currentStockResult = await db.query("SELECT * FROM stock");
    const currentRows = currentStockResult.rows;

    const rowsToDelete = currentRows
        .filter((row) => !state.some((stateRow) => row.badge_id == stateRow.id));

    const deletionPromise = db.query("DELETE FROM stock WHERE badge_id = ANY($1::text[])", [
        rowsToDelete.map((row) => row.badge_id),
    ]);

    const rowsToInsert = state
        .filter((stateRow) => !currentRows.some((row) => row.badge_id == stateRow.id));

    const insertionPromise = deletionPromise.then(() => Promise.all(rowsToInsert.map((stateRow) => {
        return db.query("INSERT INTO stock (badge_id, count, production_cost, license_cost) VALUES ($1::text, $2::int, $3::int, $4::int)", [
            stateRow.id,
            stateRow.count,
            stateRow.productionCost,
            stateRow.licenseCost,
        ]);
    })));

    const rowsToUpdate = state
        .filter((stateRow) => currentRows.some((row) => row.badge_id == stateRow.id));

    const updatePromise = deletionPromise.then(() => Promise.all(rowsToUpdate.map((stateRow) => {
        return db.query("UPDATE stock SET count=$2::int, production_cost=$3::int, license_cost=$4::int WHERE badge_id=$1::text", [
            stateRow.id,
            stateRow.count,
            stateRow.productionCost,
            stateRow.licenseCost,
        ]);
    })));

    await Promise.all([ insertionPromise, updatePromise ]);
}

function loadStockState(db, maerkelex) {
    return new Promise((resolve, reject) => {
        maerkelex.getData((error, data) => {
            if(error) {
                return reject(error);
            }
            const badgeIds = data.m.map((badge) => badge.id);

            db.query("SELECT * FROM stock WHERE badge_id = ANY($1::text[])", [ badgeIds ])
                .then((badgeStockResult) => {
                    const badgeStockLookup = {};
                    badgeStockResult.rows.forEach((row) => badgeStockLookup[row.badge_id] = row);

                    const badges = data.m
                        .filter((badge) => badge.price || badge.price == 0)
                        .map((badge) => {
                            const stock = badgeStockLookup[badge.id];
                            if(stock) {
                                badge.count = stock.count;
                                badge.productionCost = stock.production_cost / 100;
                                badge.licenseCost = stock.license_cost / 100;
                            }

                            badge.pricePretty = badge.price.toFixed(2);
                            badge.priceNoVat = badge.price * 0.8;
                            badge.priceNoVatPretty = badge.priceNoVat.toFixed(2);
                            return badge;
                        });

                    resolve(badges);
                })
                .catch(reject);
        });
    });
}

async function getBadgeCosts(db, badgeId) {
    const badgeStockResult = await db.query("SELECT * FROM stock WHERE badge_id = $1::text", [ badgeId ]);
    const info = badgeStockResult.rows[0];

    if(!info) {
        return null;
    }

    return {
        productionCost: info.production_cost / 100,
        licenseCost: info.license_cost / 100,
        count: info.count,
    };
}

async function reduceStockForBadge(db, badgeId, count) {
    const badgeStockResult = await db.query("UPDATE stock SET count = count - $2::int WHERE badge_id = $1::text RETURNING *", [ badgeId, count ]);

    return badgeStockResult.rows[0];
}
