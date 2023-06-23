/**
 * Overall class containing the setup logic
 */
class LinkItemResource5e {
  static MODULE_NAME = "link-item-resource-5e";
  static MODULE_TITLE = "Link Item and Resource DnD5e";

  static TEMPLATES = {
    resourceSelect: `modules/${this.MODULE_NAME}/templates/resource-select.hbs`
  }

  static init = () => {
    console.log(`${this.MODULE_NAME} | Initializing ${this.MODULE_TITLE}`);
    libWrapper.register(LinkItemResource5e.MODULE_NAME, 'CONFIG.Actor.documentClass.prototype.prepareData', LinkItemResource5eActor.prepareDerivedResources, "WRAPPER");
    libWrapper.register(LinkItemResource5e.MODULE_NAME, 'CONFIG.Actor.documentClass.prototype.update', LinkItemResource5eActor.prePreUpdateActor, "WRAPPER");
  }

  static setup = () => {
    console.log(`${this.MODULE_NAME} | Setting up ${this.MODULE_TITLE}`);

    loadTemplates(Object.values(this.TEMPLATES));

    Hooks.on('renderItemSheet', LinkItemResource5eItemSheet.handleRender);
    Hooks.on('renderActorSheet5eCharacter', LinkItemResource5eActorSheet.handleActorSheetRender);
    Hooks.on('dnd5e.preAdvancementManagerComplete', LinkItemResource5eActor.handlePreAdvancementComplete);
  }

  static log(...args) {
    if (game.modules.get('_dev-mode')?.api?.getPackageDebugValue(this.MODULE_NAME)) {
      console.log(this.MODULE_TITLE, '|', ...args);
    }
  }
}

Hooks.on("init", LinkItemResource5e.init);
Hooks.on("setup", LinkItemResource5e.setup);

/**
 * Contains all resource-linking logic related to the ItemSheet
 */
class LinkItemResource5eItemSheet {
  static capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
  }

  /**
   * renderItemSheet Hook callback
   * Injects the input for selecting a resouce to override
   * @param {*} itemSheet 
   * @param {*} html 
   * @returns 
   */
  static handleRender = async (itemSheet, html) => {
    const item = itemSheet.item;
    const actor = item.actor;

    // javelins for example might be set to consume ammo of themselves
    const isSelfConsumingAmmo = item.system.consume?.type === 'ammo' && item.system.consume?.target === item.id;

    // consumables with the subtype "ammo" include arrows
    const isConsumableAmmo = (item.type === "consumable") && (item.system.consumableType === "ammo");

    const itemCanBeResource = item.hasLimitedUses || isSelfConsumingAmmo || isConsumableAmmo;

    if (item.parent?.type !== 'character' || !itemCanBeResource || !actor) {
      return;
    }

    const resourceOptions = Object.keys(actor.system.resources)
      .reduce((acc, resourceKey) => {
        acc[resourceKey] = game.i18n.localize(`DND5E.Resource${this.capitalizeFirstLetter(resourceKey)}`);
        return acc
      }, {});

    const currentValue = item.getFlag(LinkItemResource5e.MODULE_NAME, 'resource-link');

    const select = await renderTemplate(LinkItemResource5e.TEMPLATES.resourceSelect, {
      resourceOptions,
      currentValue,
    })

    let el;
    if (item.hasLimitedUses) {
      el = html.find('.uses-per').first();
    } else if (isSelfConsumingAmmo) {
      el = html.find('.uses-per').last();
    } else {
      el = html.find('[name="system.consumableType"]').parents('.form-group');
    }

    el.after(select);
    itemSheet.setPosition();
  }
}


/**
 * Contains all resource-linking logic related to the Actor Document
 */
class LinkItemResource5eActor {
  /**
   * Builds resource overrides from actor item list
   */
  static getResourceOverrides(items) {
    let warnings = new Set();

    const filteredItems = items.filter(item => !!item.getFlag(LinkItemResource5e.MODULE_NAME, 'resource-link'));

    if (!filteredItems.length) {
      return {
        resourceOverrides: undefined,
        warnings: [],
      }
    }

    const resourceOverrides = filteredItems.reduce((acc, item) => {
      const resourceOverride = item.getFlag(LinkItemResource5e.MODULE_NAME, 'resource-link');

      if (acc[resourceOverride]) {
        warnings.add(`${LinkItemResource5e.MODULE_NAME}.warn-multiple-overrides`)
      }

      acc[resourceOverride] = item.id;
      return acc;
    }, {});

    return {
      resourceOverrides,
      warnings: [...warnings.values()],
    }
  }

  /**
   * `Actor5e.prepareData` WRAPPER
   * Overrides the flagged resources with item details.
   * Has to run after all the owned items have run `prepareFinalAttributes` so items have numerical charges
   * @param {*} wrapped 
   * @param  {...any} args 
   * @returns 
   */
  static prepareDerivedResources(wrapped, ...args) {
    wrapped(...args);

    const data = this.system;
    const items = this.items;

    // Record<resourceName, itemId>
    const { resourceOverrides, warnings } = LinkItemResource5eActor.getResourceOverrides(items);

    this._preparationWarnings.push(...warnings);

    if (!resourceOverrides) {
      return;
    }

    Object.entries(resourceOverrides).forEach(([resource, itemId]) => {
      const relevantItem = items.get(itemId)
      if (!relevantItem) return;
      const { quantity, uses } = relevantItem.system;
      const { value, max, per } = uses;

      // put the quantity in the name if relevant
      const composedName = [relevantItem.name, (relevantItem.hasLimitedUses && quantity > 1) ? `(${quantity})` : undefined].filterJoin(' ');

      // any item with charges -> Use the charges
      if (relevantItem.hasLimitedUses) {
        data.resources[resource] = {
          label: composedName,
          value,
          max,
          sr: per === 'sr',
          lr: ['sr', 'lr'].includes(per),
        }
        return;
      }

      // in these cases we want to display the quantity as the value and max
      // we also need special logic to adjust the quantity of the item when the resource numbers are updated
      // we also also need to ensure the item fields are disabled

      data.resources[resource] = {
        label: composedName,
        value: quantity,
        max: quantity,
        sr: false,
        lr: false,
      }
    });
  }

  /**
   * Wraps `Actor.update` so we can attack the update before it is diffed.
   */
  static prePreUpdateActor(wrapped, updateRequest, ...args) {
    const { resourceOverrides: currentOverrides } = LinkItemResource5eActor.getResourceOverrides(this.items);

    if (!currentOverrides) {
      // do nothing, move on
      return wrapped(updateRequest, ...args);
    }

    const newUpdateRequest = { ...foundry.utils.expandObject(updateRequest) };
    const resourceUpdates = foundry.utils.getProperty(newUpdateRequest, `system.resources`);

    if (!resourceUpdates) {
      // do nothing, move on
      return wrapped(updateRequest, ...args);
    }

    // array of resource keys which are being updated that have overrides
    const updatesToOverriddenResources = Object.keys(resourceUpdates)
      .filter((resource) => !!currentOverrides[resource]);

    // abort if there's none we care about
    if (!updatesToOverriddenResources.length) {
      return wrapped(updateRequest, ...args);
    }

    // construct item updates based on the updateData
    const itemUpdates = updatesToOverriddenResources
      .map((resourceKey) => {
        const itemId = currentOverrides[resourceKey];
        const relevantItem = this.items.get(itemId);

        // if the item has charges, update its charges
        if (relevantItem.hasLimitedUses) {
          return {
            _id: currentOverrides[resourceKey],
            system: {
              uses: {
                value: resourceUpdates[resourceKey].value,
              },
            }
          }
        }

        // else update its quantity
        return {
          _id: currentOverrides[resourceKey],
          system: {
            quantity: resourceUpdates[resourceKey].value,
          }
        }
      })

    // add the item updates to this update operation
    newUpdateRequest.items = [...(updateRequest?.items ?? []), ...itemUpdates];

    // set the overridden resource update to undefined
    updatesToOverriddenResources.forEach((resourceKey) => {
      foundry.utils.setProperty(newUpdateRequest, `system.resources.${resourceKey}`, undefined);
    });

    return wrapped(newUpdateRequest, ...args);
  }

  /**
   * Handles advancements setting an actor's resources in the final update data, nulling out the quantities of overriden item resources.
   * Mutates `updateData` to remove any nullifications that would happen
   * @param {*} advancementManager 
   * @param {*} updateData 
   */
  static handlePreAdvancementComplete(advancementManager, updateData) {
    const { resourceOverrides: currentOverrides } = LinkItemResource5eActor.getResourceOverrides(advancementManager.clone.items);

    if (!currentOverrides) {
      // do nothing, move on
      return;
    }

    const resourceUpdates = foundry.utils.getProperty(updateData, `system.resources`);

    // array of resource keys which are being updated that have overrides
    const updatesToOverriddenResources = Object.keys(resourceUpdates)
      .filter((resource) => !!currentOverrides[resource]);

    // abort if there's none we care about
    if (!updatesToOverriddenResources.length) {
      return;
    }

    // set the overridden resource update to undefined
    updatesToOverriddenResources.forEach((resourceKey) => {
      foundry.utils.setProperty(updateData, `system.resources.${resourceKey}`, undefined);
    });
  }
}


/**
 * Contains all resource-linking logic related to the ActorSheet
 */
class LinkItemResource5eActorSheet {
  // from 5e sheet resources plus module
  static sheetResources = [
    "primary",
    "secondary",
    "tertiary",
    "fourth",
    "fifth",
    "sixth",
    "seventh",
    "eighth",
    "ninth",
    "tenth",
    "eleventh",
    "twelfth",
    "thirteenth",
    "fourteenth",
    "fifteenth",
    "sixteenth",
    "seventeenth",
    "eighteenth",
    "nineteenth",
    "twentieth",
    "count",
  ];

  static getIndexFromResourceName = (resourceName) => {
    return this.sheetResources.indexOf(resourceName);
  }

  /**
   * renderActorSheet hook callback
   * @param {*} actorSheet 
   * @param {*} html 
   * @returns 
   */
  static handleActorSheetRender = (actorSheet, html) => {
    const actor = actorSheet.actor;
    const { resourceOverrides } = LinkItemResource5eActor.getResourceOverrides(actor.items);

    if (!resourceOverrides) {
      return;
    }

    this.disableDerivedResourceFields(resourceOverrides, html, actor);
    this.disableOverriddenItemFields(resourceOverrides, html, actor);
  }

  /**
   * Disables all inputs in an overriden resource fieldset except `value`.
   * @param {*} resourceOverrides
   * @param {*} html
   */
  static disableDerivedResourceFields = (resourceOverrides, html, actor) => {
    const indexesToDisable = Object.keys(resourceOverrides).map((resourceName) => {
      return {
        index: this.sheetResources.indexOf(resourceName),
        itemId: resourceOverrides[resourceName]
      }
    });
    const resourceElements = html.find('.resource');

    // get the resources which have overrides to disable inputs
    indexesToDisable.forEach(({ index, itemId }) => {
      const element = resourceElements[index];

      // disable every input except the `value` input
      $(element).find('[name]').filter((index, el) => !el.name.includes('value'))
        .prop('disabled', true)
        .prop('title', game.i18n.localize(`${LinkItemResource5e.MODULE_NAME}.disabled-resource-helper-text`));

      // for cases where this isn't showing charges, delete the separator and max
      if (!actor.items.get(itemId).hasLimitedUses) {
        $(element).find('.sep').remove();
        $(element).find('[name*="max"]').remove();
      }
    });
  }

  /**
   * Disables the Item Uses inputs on the inventory level for items which override resource.
   * This is necessary to avoid a double-update which results in no actual change.
   * @param {*} resourceOverrides 
   * @param {*} html 
   * @returns 
   */
  static disableOverriddenItemFields = (resourceOverrides, html, actor) => {
    const itemIdsToDisable = Object.values(resourceOverrides);

    // get the resources which have overrides to disable inputs
    itemIdsToDisable.forEach(itemId => {
      html.find(`[data-item-id=${itemId}] .item-uses input, [data-item-id=${itemId}] .item-charges input`)
        .prop('disabled', true)
        .prop('title', game.i18n.localize(`${LinkItemResource5e.MODULE_NAME}.disabled-item-helper-text`));

      // for cases where this isn't showing charges, delete the separator and max
      if (!actor.items.get(itemId).hasLimitedUses) {
        html.find(`[data-item-id=${itemId}] .item-quantity input`)
          .prop('disabled', true)
          .prop('title', game.i18n.localize(`${LinkItemResource5e.MODULE_NAME}.disabled-item-helper-text`));
      }
    });
  }
}
