// let transferEffect = Effect(11, 600, e -> {
//     // if(!(e.data instanceof PayloadMassDriverData data)) return;
//     Tmp.v1.set(data.x, data.y).lerp(data.ox, data.oy, Interp.sineIn.apply(e.fin()));
//     data.payload.set(Tmp.v1.x, Tmp.v1.y, e.rotation);
//     data.payload.draw();
// }).layer(Layer.flyingUnitLow - 1);
let blockName = "payload-mass-driver"
let payloadMassDriver = Blocks.payloadMassDriver;
let massDriver = Blocks.massDriver;

massDriver.knockback = 5;
massDriver.region = Core.atlas.find(blockName);
massDriver.bullet = extend(MassDriverBolt, { draw: () => {} })
massDriver.shootEffect = Fx.shootBig2;
massDriver.smokeEffect = Fx.shootPayloadDriver;
massDriver.receiveEffect = Fx.payloadReceive;
massDriver.shootSound = Sounds.shootBig;
// Blocks.massDriver.topRegion = Core.atlas.find(blockName + "-top");
Blocks.massDriver.buildType = () => extend(MassDriver.MassDriverBuild, Blocks.massDriver, {
    length: 89 / 8,
    grabWidth: 8,
    grabHeight: 11. / 4,
    charge: 100,
    discharge: 10,
    baseRegion: Core.atlas.find(blockName + "-base"),
    topRegion: Core.atlas.find(blockName + "-top"),
    capRegion: Core.atlas.find(blockName + "-cap"),
    leftRegion: Core.atlas.find(blockName + "-left"),
    rightRegion: Core.atlas.find(blockName + "-right"),
    capOutlineRegion: Core.atlas.find(blockName + "-cap-outline"),
    leftOutlineRegion: Core.atlas.find(blockName + "-left-outline"),
    rightOutlineRegion: Core.atlas.find(blockName + "-right-outline"),
    arrow: Core.atlas.find("bridge-arrow"),

    targetSize: 0, curSize: 0,

    transferEffect: Fx.none,

    init(a, b, c, d) {
        this.targetSize = this.grabWidth * 2;
        this.curSize = this.targetSize;

        let effect = extend(Effect, 11, 600, e => {
            if (!(e.data instanceof MassDriver.DriverBulletData)) return;
            let data = e.data;

            Tmp.v1.set(data.from.x, data.from.y).lerp(data.to.x, data.to.y, Interp.sineIn.apply(e.fin()));
            Draw.rect(this.arrow, Tmp.v1.x, Tmp.v1.y, e.rotation)
            let greatest = 0;
            let greatestAmount = 0;
            let totalAmount = 0;
            for(let i = 0; i < data.items.length; i++){
                let items = data.items[i];
                if(items > greatestAmount){
                    greatest = i;
                    greatestAmount = items;
                }
                totalAmount += items;
            }
            let item = Vars.content.item(greatest);
            Draw.xscl = Draw.yscl = 1.5 * Math.min(totalAmount / this.block.minDistribute, 1) * (Math.log(totalAmount / (this.block.itemCapacity - this.block.minDistribute)) / 5 + 1);
            Draw.rect(item.fullIcon, Tmp.v1.x, Tmp.v1.y, e.rotation);
            Draw.xscl = Draw.yscl = 0;
        }, {});
        effect.layer = Layer.flyingUnitLow - 1;

        this.transferEffect = effect;

        return this.super$init(a, b, c, d);
    },

    updateTile() {
        this.super$updateTile();

        let itemSize = 2 * this.itemPercent();

        this.curSize = Mathf.lerpDelta(this.curSize, this.targetSize, 0.05);
        this.targetSize = Math.max(Vars.tilesize * 1, Vars.tilesize * 2 * itemSize)


        if(this.items.any()){
            this.targetSize = Mathf.clamp(Vars.tilesize * ((this.items.total() - this.block.minDistribute) / (this.block.itemCapacity - this.block.minDistribute) + 1), Vars.tilesize, Vars.tilesize * 2);
        }

        if (this.state == MassDriver.DriverState.accepting && this.currentShooter() != null) {
            let currentWidth = Mathf.clamp(Vars.tilesize * ((this.items.total() - this.block.minDistribute) / (this.block.itemCapacity - this.block.minDistribute) + 1), Vars.tilesize, Vars.tilesize * 2);
            let shooterWidth = Mathf.clamp(Vars.tilesize * ((this.currentShooter().items.total() - this.block.minDistribute) / (this.block.itemCapacity - this.block.minDistribute) + 1), Vars.tilesize, Vars.tilesize * 2);
            this.targetSize = this.items.any() ? Math.max(shooterWidth, currentWidth) : shooterWidth;
        }
    },

    itemPercent() {
        let totalUsed = 0;
        for (let i = 0; i < Vars.content.items().size; i++) {
            let maxTransfer = Math.min(this.items.get(Vars.content.item(i)), this.tile.block().itemCapacity - totalUsed);
            totalUsed += maxTransfer;
        }

        let size = totalUsed / this.block.itemCapacity;

        return size;
    },

    fire(target) {
        //reset reload, use power.
        this.reloadCounter = 1;

        let data = Pools.obtain(MassDriver.DriverBulletData, () => MassDriver.DriverBulletData());
        data.from = this;
        data.to = target;

        let totalUsed = 0;
        for (let i = 0; i < Vars.content.items().size; i++) {
            let maxTransfer = Math.min(this.items.get(Vars.content.item(i)), this.tile.block().itemCapacity - totalUsed);
            data.items[i] = maxTransfer;
            totalUsed += maxTransfer;
            this.items.remove(Vars.content.item(i), maxTransfer);
        }

        let angle = this.tile.angleTo(target);

        this.block.bullet.create(this, this.team,
            this.x + Angles.trnsx(angle, this.block.translation), this.y + Angles.trnsy(angle, this.block.translation),
            angle, -1, this.block.bulletSpeed, this.block.bulletLifetime, data);

        let cx = Angles.trnsx(this.rotation, this.length), cy = Angles.trnsy(this.rotation, this.length);

        this.block.shootEffect.at(this.x + cx, this.y + cy, angle);
        this.block.smokeEffect.at(this.x + cx, this.y + cy, angle);

        Effect.shake(this.block.shake, this.block.shake, this);

        // this.block.shootSound.at(this.tile, Mathf.random(0.9, 1.1));

        

        let timeToArrive = Math.min(this.block.bulletLifetime, this.dst(target) / this.block.bulletSpeed);

        this.transferEffect.lifetime = timeToArrive;
        this.transferEffect.at(this.x + cx, this.y + cy, this.rotation, data);
    },

    draw() {
        // this.super$draw();

        let tx = this.x + Angles.trnsx(this.rotation + 180, this.reloadCounter * this.block.knockback),
            ty = this.y + Angles.trnsy(this.rotation + 180, this.reloadCounter * this.block.knockback),
            r = this.rotation - 90;

        Draw.rect(this.baseRegion, this.x, this.y);

        let itemSize = 2 * this.itemPercent();
        let loadSize = Math.min(this.items.total() / this.block.minDistribute, 1) * (Math.log(this.items.total() / (this.block.itemCapacity - this.block.minDistribute)) / 5 + 1);

        Draw.z(Layer.blockOver);
        if (this.items.any()) {
            Draw.z((/*loadSize >= 1 && */ this.state == MassDriver.DriverState.shooting) ? Layer.blockOver + 0.2 : Layer.blockOver);
            let offset = this.state == MassDriver.DriverState.shooting ? Math.min(loadSize, 1) : 0;
            let loadedX = this.state == MassDriver.DriverState.shooting ? tx : this.x;
            let loadedY = this.state == MassDriver.DriverState.shooting ? ty : this.y;
            Draw.xscl = Draw.yscl = loadSize * 1.5;
            Draw.rect(this.items.first().fullIcon, loadedX + Angles.trnsx(this.rotation, this.length * offset) , loadedY + Angles.trnsy(this.rotation, this.length * offset) );
            Draw.xscl = Draw.yscl = 1;
        }

        Draw.z(Layer.blockOver + 0.1);

        Draw.rect(this.topRegion, this.x, this.y);

        Draw.z(Layer.turret);
        //TODO
        Drawf.shadow(this.block.region, tx - (this.size / 2), ty - (this.size / 2), r);

        Tmp.v1.trns(this.rotation, 0, -(this.curSize / 2 - this.grabWidth));
        Tmp.v2.trns((this.rotation / 90) % 4, -Math.max(this.curSize / 2 - this.grabHeight - this.length, 0), 0);
        let rx = tx + Tmp.v1.x + Tmp.v2.x, ry = ty + Tmp.v1.y + Tmp.v2.y;
        let lx = tx - Tmp.v1.x + Tmp.v2.x, ly = ty - Tmp.v1.y + Tmp.v2.y;

        Draw.rect(this.capOutlineRegion, tx, ty, r);
        Draw.rect(this.leftOutlineRegion, lx, ly, r);
        Draw.rect(this.rightOutlineRegion, rx, ry, r);

        Draw.rect(this.leftRegion, lx, ly, r);
        Draw.rect(this.rightRegion, rx, ry, r);
        Draw.rect(this.capRegion, tx, ty, r);

        Draw.z(Layer.effect);

        let beginCharge = (this.charge + this.discharge) / this.block.reload;

        let hasLink = this.linkValid();
        let link = Vars.world.build(this.link);

        if (this.state == MassDriver.DriverState.shooting &&
            hasLink &&
            this.items.total() >= this.block.minDistribute && //must shoot minimum amount of items
            // link.block.itemCapacity - link.items.total() >= this.block.minDistribute && //must have minimum amount of space
            // link.currentShooter() == this &&
            // link.state == MassDriver.DriverState.accepting &&
            // Angles.near(this.rotation, this.angleTo(link), 2) && Angles.near(link.rotation, this.angleTo(link) + 180, 2) &&
            this.reloadCounter < beginCharge
        ) {
            let angle = this.angleTo(link);

            let chargingPercent = this.reloadCounter / beginCharge;
            let chargePercent = this.charge / this.block.reload;
            let dischargePercent = this.discharge / this.block.reload;
            let chargingDischarged = Mathf.clamp((this.reloadCounter - dischargePercent) / chargePercent, 0, 1);

            let chargingDischarge = chargingDischarged - Math.min(0, (chargingPercent - dischargePercent) / dischargePercent);

            let fin = Interp.pow2Out.apply(1 - chargingDischarge), fout = 1 - fin, len = this.length * 1.8, w = this.curSize / 2 + 7 * fout;
            let right = Tmp.v1.trns(angle, len, w);
            let left = Tmp.v2.trns(angle, len, -w);

            Lines.stroke(fin * 1.2, Pal.accent);
            Lines.line(this.x + left.x, this.y + left.y, link.x - right.x, link.y - right.y);
            Lines.line(this.x + right.x, this.y + right.y, link.x - left.x, link.y - left.y);

            for (let i = 0; i < 4; i++) {
                Tmp.v3.set(this.x, this.y).lerp(link.x, link.y, 0.5 + (i - 2) * 0.1);

                Draw.xscl = Draw.yscl = fin * 1.1;
                Draw.rect(this.arrow, Tmp.v3.x, Tmp.v3.y, angle);
                Draw.xscl = Draw.yscl = 1;
            }

            Draw.reset();
        }
    }
});