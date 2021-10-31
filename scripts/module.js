/**
 * Overall class containing the setup logic
 */
class LinkItemResource5e {
  static MODULE_NAME = "link-item-resource-5e";
  static MODULE_TITLE = "Link Item and Resource DnD5e";

  static TEMPLATES = {
    resourceSelect: `modules/${this.MODULE_NAME}/templates/resource-select.hbs`
  }

  static setup = () => {
    console.log(`${this.MODULE_NAME} | Initializing ${this.MODULE_TITLE}`);

    loadTemplates(Object.values(this.TEMPLATES));

    libWrapper.register(LinkItemResource5e.MODULE_NAME, 'CONFIG.Actor.documentClass.prototype.prepareData', LinkItemResource5eActor.prepareDerivedResources, "WRAPPER");

    Hooks.on('renderItemSheet', LinkItemResource5eItemSheet.handleRender);
    Hooks.on('preUpdateActor', LinkItemResource5eActor.handlePreUpdateActor);
    Hooks.on('renderActorSheet5eCharacter', LinkItemResource5eActorSheet.handleActorSheetRender);
  }
}

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

    if (item.parent?.type !== 'character' || !item.hasLimitedUses || !actor) {
      return;
    }

    const resourceOptions = Object.keys(actor.data.data.resources)
      .reduce((acc, resourceKey) => {
        acc[resourceKey] = game.i18n.localize(`DND5E.Resource${this.capitalizeFirstLetter(resourceKey)}`);
        return acc
      }, {});

    const currentValue = item.getFlag(LinkItemResource5e.MODULE_NAME, 'resource-link');

    const select = await renderTemplate(LinkItemResource5e.TEMPLATES.resourceSelect, {
      resourceOptions,
      currentValue,
    })

    const el = html.find('.uses-per').first()

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

    const actorData = this.data;
    const data = actorData.data;
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
      const { value, max, per } = relevantItem.data.data.uses ?? {};

      data.resources[resource] = {
        label: relevantItem.name,
        value,
        max,
        sr: per === 'sr',
        lr: ['sr', 'lr'].includes(per),
      }
    });
  }

  /**
   * preUpdateActor hook callback
   * Mutates `updateData` to correctly update the item instead of the actor resource in cases
   * where the resource is overridden.
   * @param {*} actor 
   * @param {*} updateData 
   * @returns 
   */
  static handlePreUpdateActor = (actor, updateData) => {
    const { resourceOverrides: currentOverrides } = LinkItemResource5eActor.getResourceOverrides(actor.items);

    // get any updates to the actor's resources
    const resourceUpdates = foundry.utils.getProperty(updateData, `data.resources`);
    if (!currentOverrides || !resourceUpdates) {
      return;
    }

    // array of resource keys which are being updated that have overrides
    const updatesToOverriddenResources = Object.keys(resourceUpdates)
      .filter((resource) => !!currentOverrides[resource]);

    // abort if there's none we care about
    if (!updatesToOverriddenResources.length) {
      return;
    }

    // construct item updates based on the updateData
    const itemUpdates = updatesToOverriddenResources
      .map((resourceKey) => ({
        _id: currentOverrides[resourceKey],
        'data.uses.value': resourceUpdates[resourceKey].value,
      }))

    // add the item updates to this update operation
    updateData.items = [...(updateData?.items ?? []), ...itemUpdates];

    // set the overridden resource update to undefined
    updatesToOverriddenResources.forEach((resourceKey) => {
      foundry.utils.setProperty(updateData, `data.resources.${resourceKey}`, undefined);
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

    this.disableDerivedResourceFields(resourceOverrides, html);
    this.disableOverriddenItemFields(resourceOverrides, html);
  }

  /**
   * Disables all inputs in an overriden resource fieldset except `value`.
   * @param {*} resourceOverrides
   * @param {*} html
   */
  static disableDerivedResourceFields = (resourceOverrides, html) => {
    const indexesToDisable = Object.keys(resourceOverrides).map(this.getIndexFromResourceName);
    const resourceElements = html.find('.resource');

    // get the resources which have overrides to disable inputs
    indexesToDisable.forEach(index => {
      const element = resourceElements[index];
      // disable every input except the `value` input
      $(element).find('[name]').filter((index, el) => !el.name.includes('value'))
        .prop('disabled', true)
        .prop('title', game.i18n.localize(`${LinkItemResource5e.MODULE_NAME}.disabled-resource-helper-text`));
    })
  }

  /**
   * Disables the Item Uses inputs on the inventory level for items which override resource.
   * This is necessary to avoid a double-update which results in no actual change.
   * @param {*} resourceOverrides 
   * @param {*} html 
   * @returns 
   */
  static disableOverriddenItemFields = (resourceOverrides, html) => {
    const itemIdsToDisable = Object.values(resourceOverrides);

    // get the resources which have overrides to disable inputs
    itemIdsToDisable.forEach(itemId => {
      html.find(`[data-item-id=${itemId}] .item-uses input`)
        .prop('disabled', true)
        .prop('title', game.i18n.localize(`${LinkItemResource5e.MODULE_NAME}.disabled-item-helper-text`));
    });
  }
}
