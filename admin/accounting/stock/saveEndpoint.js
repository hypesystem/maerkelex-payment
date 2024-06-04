export default (stock) => (req, res) => {
    if(!Array.isArray(req.body)) {
        return res.fail(400, "Request body must be an array.");
    }
    const state = req.body
        .filter((badge) => {
            return (badge.productionCost || badge.productionCost === 0) && (badge.licenseCost || badge.licenseCost === 0) && (badge.count || badge.count === 0);
        })
        .map((badge) => {
            return {
                id: badge.id,
                count: parseInt(badge.count),
                productionCost: parseInt(parseFloat(badge.productionCost) * 100),
                licenseCost: parseInt(parseFloat(badge.licenseCost) * 100),
            };
        });

    //TODO: validation

    stock.saveState(state)
        .then(() => res.send())
        .catch((error) => {
            console.error("Something went wrong", error);
            res.fail(500, "Something went wrong");
        });
};
