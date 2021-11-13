# Link Item and Resource DnD5e

![Foundry Core Compatible Version](https://img.shields.io/badge/dynamic/json.svg?url=https%3A%2F%2Fraw.githubusercontent.com%2FElfFriend-DnD%2Ffoundryvtt-link-item-resource-5e%2Fmain%2Fmodule.json&label=Foundry%20Version&query=$.compatibleCoreVersion&colorB=orange)
![Latest Release Download Count](https://img.shields.io/badge/dynamic/json?label=Downloads@latest&query=assets%5B1%5D.download_count&url=https%3A%2F%2Fapi.github.com%2Frepos%2FElfFriend-DnD%2Ffoundryvtt-link-item-resource-5e%2Freleases%2Flatest)
![Forge Installs](https://img.shields.io/badge/dynamic/json?label=Forge%20Installs&query=package.installs&suffix=%25&url=https%3A%2F%2Fforge-vtt.com%2Fapi%2Fbazaar%2Fpackage%2Flink-item-resource-5e&colorB=4aa94a)
[![Foundry Hub Endorsements](https://img.shields.io/endpoint?logoColor=white&url=https%3A%2F%2Fwww.foundryvtt-hub.com%2Fwp-json%2Fhubapi%2Fv1%2Fpackage%2Flink-item-resource-5e%2Fshield%2Fendorsements)](https://www.foundryvtt-hub.com/package/link-item-resource-5e/)
[![Foundry Hub Comments](https://img.shields.io/endpoint?logoColor=white&url=https%3A%2F%2Fwww.foundryvtt-hub.com%2Fwp-json%2Fhubapi%2Fv1%2Fpackage%2Flink-item-resource-5e%2Fshield%2Fcomments)](https://www.foundryvtt-hub.com/package/link-item-resource-5e/)

[![ko-fi](https://img.shields.io/badge/-buy%20me%20a%20coke-%23FF5E5B)](https://ko-fi.com/elffriend)
[![patreon](https://img.shields.io/badge/-patreon-%23FF424D)](https://www.patreon.com/ElfFriend_DnD)

Adds the ability to link an item's charges or quantity to an actor's resource and thus keep the two always in sync.

Attempts to follow as much of the Item charge consumption logic from the core system as is reasonable. This allows for the following (known) use cases:

- Display the Charges (and Quantities) of any Item/Feature/Spell with limited uses
- Display the Quantities of Ammo Consumable Items (e.g. Arrows)
- Display the Quantities Items which consume their own quantity as Ammo (e.g. Javelin)

Each of these is also editable directly from the Resource indicator.

![An input is added to the item sheet.](https://user-images.githubusercontent.com/7644614/139600193-4f66564b-a274-4df7-8329-5cacca221da7.jpg)

![When configured, the item uses overrides the actor's resources.](https://user-images.githubusercontent.com/7644614/139600191-85f90ead-222a-4d5c-83a6-ff8d8c63134c.jpg)
(Outlines added for demonstration)


https://user-images.githubusercontent.com/7644614/139600186-1f0eaa5e-bc43-4867-9e8b-3fdbef217382.mp4

<details>
<summary>More Configuration Examples</summary>

![Example of an Item with both Charges and Quantity displayed as Resource.](https://user-images.githubusercontent.com/7644614/141603970-57f0733f-8e21-4c60-bc1a-6b1036498c58.jpg)

![Example of a Configuration with Arrow Quantity used as Resource.](https://user-images.githubusercontent.com/7644614/141603969-aa4b2513-6540-4220-a25b-3f6415fbaefe.jpg)

![Example of self-consuming item.](https://user-images.githubusercontent.com/7644614/141603971-b917ca40-27b8-48ac-b88c-9a23e02f5cbc.jpg)
</details>


## Compatibility Notes

Kind of works with [Resource Icons](https://www.foundryvtt-hub.com/package/resource-icons/). Sometimes the number will not update until the actor is updated again.

Tested with the following Actor Sheet Modules:

- [Compact DnDBeyond 5e Character Sheet](https://www.foundryvtt-hub.com/package/compact-beyond-5e-sheet/) (pictured above)
- [Tidy5e Sheet](https://www.foundryvtt-hub.com/package/tidy5e-sheet/)
- [DNDBeyond Character Sheet for 5E](https://www.foundryvtt-hub.com/package/dndbeyond-character-sheet/)
- [D&D 5e OGL Character Sheet](https://www.foundryvtt-hub.com/package/5e-ogl-character-sheet/)
