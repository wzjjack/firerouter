/*    Copyright 2019 Firewalla Inc
 *
 *    This program is free software: you can redistribute it and/or modify
 *    it under the terms of the GNU Affero General Public License, version 3,
 *    as published by the Free Software Foundation.
 *
 *    This program is distributed in the hope that it will be useful,
 *    but WITHOUT ANY WARRANTY; without even the implied warranty of
 *    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *    GNU Affero General Public License for more details.
 *
 *    You should have received a copy of the GNU Affero General Public License
 *    along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

'use strict';

const InterfaceBasePlugin = require('./intf_base_plugin.js');
const exec = require('child-process-promise').exec;

class BridgeInterfacePlugin extends InterfaceBasePlugin {

  async flush() {
    await super.flush();
    if (this.networkConfig && this.networkConfig.enabled) {
      await exec(`sudo ip link set dev ${this.name} down`).catch((err) => {});
      await exec(`sudo brctl delbr ${this.name}`).catch((err) => {});
    }
  }

  async createInterface() {
    for (const intf of this.networkConfig.intf) {
      await exec(`sudo ip addr flush dev ${intf}`);
    }

    await exec(`sudo brctl addbr ${this.name}`).catch((err) => {
      this.log.error(`Failed to create bridge interface ${this.name}`, err.message);
    });
    await exec(`sudo brctl stp ${this.name} on`).catch((err) => {
      this.log.error(`Failed to enable stp on bridge interface ${this.name}`, err.message);
    })
    await exec(`sudo brctl addif ${this.name} ${this.networkConfig.intf.join(" ")}`).catch((err) => {
      this.log.error(`Failed to add interfaces to bridge ${this.name}`, err.message);
    });
  }
}

module.exports = BridgeInterfacePlugin;