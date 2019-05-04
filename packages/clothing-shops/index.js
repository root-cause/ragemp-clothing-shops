const fs = require("fs");
const path = require("path");

const markerRange = 1.75;
const markerColor = [174, 219, 242, 150];

// Would be great if you don't touch this
const allowedModels = {};
allowedModels[ mp.joaat("mp_m_freemode_01") ] = "male";
allowedModels[ mp.joaat("mp_f_freemode_01") ] = "female";

const shopData = {};

function giveClothingToPlayer(player, name, type, slot, drawable, texture) {
    slot = Number(slot);
    drawable = Number(drawable);
    texture = Number(texture);

    switch (type) {
        case "clothes":
            player.setClothes(slot, drawable, texture, 2);
        break;

        case "props":
            player.setProp(slot, drawable, texture);
        break;
    }

    player.call("clothesMenu:updateLast", [drawable, texture]);
    player.notify(`Bought ${name}.`);
}

// Load all clothes
const shopsPath = path.join(__dirname, "shops");
fs.readdir(shopsPath, (error, files) => {
    if (error) {
        console.error(`[CLOTHES] Failed reading clothing data: ${error.message}`);
        return;
    }

    for (const file of files) {
        if (path.extname(file) !== ".json") continue;

        const filePath = path.join(shopsPath, file);
        const fileName = path.basename(filePath, ".json");

        try {
            shopData[fileName] = require(filePath);

            // Create shop entities
            for (const shopPosition of shopData[fileName].shops) {
                const tempColShape = mp.colshapes.newSphere(shopPosition.x, shopPosition.y, shopPosition.z, markerRange * 0.9);
                tempColShape.clothingShopType = fileName;

                mp.labels.new("Clothing Shop\n/buyclothes", new mp.Vector3(shopPosition.x, shopPosition.y, shopPosition.z + 1.0), {
                    los: true,
                    font: 0,
                    drawDistance: markerRange * 2.0
                });

                mp.markers.new(1, shopPosition, markerRange, {
                    visible: true,
                    color: markerColor
                });

                mp.blips.new(73, shopPosition, {
                    name: "Clothing Shop",
                    shortRange: true
                });
            }

            console.log(`[CLOTHES] Loaded ${file}.`);
        } catch (loadingError) {
            console.error(`[CLOTHES] Failed to load ${file}: ${loadingError.message}`);
        }
    }
});

// RAGEMP Events
mp.events.add("playerEnterColshape", (player, shape) => {
    if (shape.clothingShopType && typeof player.clothingShopType !== "string") player.clothingShopType = shape.clothingShopType;
});

mp.events.add("playerExitColshape", (player, shape) => {
    if (shape.clothingShopType && player.clothingShopType) {
        player.clothingShopType = null;
        player.call("clothesMenu:close");
    }
});

// Script Events
mp.events.add("buyClothingItem", (player, type, slot, texture, drawable, price) => {
    // Extra spaghetti for verification
    if (typeof player.clothingShopType !== "string") {
        player.outputChatBox("You're not in a clothing shop marker.");
        return;
    }

    const key = allowedModels[player.model];
    if (typeof key !== "string") {
        player.outputChatBox("Your model is not allowed to use clothing shops.");
        return;
    }

    let item = shopData[player.clothingShopType][key];
    if (!Object.keys(item).includes(type)) {
        console.log(`[CLOTHES] Player ${player.name} sent invalid item type.`);
        return;
    }

    item = shopData[player.clothingShopType][key][type];
    if (!item.hasOwnProperty(slot)) {
        console.log(`[CLOTHES] Player ${player.name} sent invalid slot.`);
        return;
    }

    item = shopData[player.clothingShopType][key][type][slot];

    const itemIdx = item.findIndex(i => i.texture === texture && i.drawable === drawable && i.price === price);
    item = item[itemIdx];

    if (typeof item === "undefined") {
        console.log(`[CLOTHES] Player ${player.name} sent invalid item.`);
        return;
    }

    if (Number.isInteger(item.price)) {
        // Currency API is needed for this
        if (player.getCurrency("cash") < item.price) {
            player.notify("You can't afford this item.");
            return;
        }

        player.changeCurrency("cash", -item.price);
        giveClothingToPlayer(player, item.name, type, slot, item.drawable, item.texture);
    } else {
        giveClothingToPlayer(player, item.name, type, slot, item.drawable, item.texture);
    }
});

// Commands
mp.events.addCommand("buyclothes", (player) => {
    if (typeof player.clothingShopType !== "string") {
        player.outputChatBox("You're not in a clothing shop marker.");
        return;
    }

    const key = allowedModels[player.model];
    if (typeof key !== "string") {
        player.outputChatBox("Your model is not allowed to use clothing shops.");
        return;
    }

    const shop = shopData[player.clothingShopType];
    if (typeof shop[key] === "undefined") {
        player.outputChatBox("Your model does not have any clothes available.");
        return;
    }

    player.call("clothesMenu:updateData", [ shop.bannerSprite, shop[key] ]);
});