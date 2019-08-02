
function converter(json) {
	this.jsonFile = JSON.parse(json);
	this.SHDfile = new SHDfile();
	console.log(this.jsonFile);
	this.convert = function() {
		var name = "pvShdArrayTracking";
		
		//find drawings center
		//var xcenter = this.jsonFile.tables.viewPort.viewPorts[0].center.x;
		//var ycenter = this.jsonFile.tables.viewPort.viewPorts[0].center.y;

		var map = new Map();
		//get positions of all modules
		for(var i in this.jsonFile.entities) {
			if (this.jsonFile.entities[i].layer == "Modules") {
				var x = ((this.jsonFile.entities[i].position.x) * -0.0254).toFixed(1);
				var y = ((this.jsonFile.entities[i].position.y) * -0.0254).toFixed(1);
				var z = (this.jsonFile.entities[i].position.z * -0.0254).toFixed(1);
				var pvShdArray = new pvShdArrayTracking(name);
				pvShdArray.x = x;
				pvShdArray.y = y;
				pvShdArray.z = z;
				pvShdArray.ySpacing = -1;
				this.SHDfile.ListeObjets.push(pvShdArray);

				/*IMPLEMINTATION WITH NElemChamps -- DOES NOT WORK
				if(!map.has(x) || this.SHDfile.ListeObjets.length == 0) {
					var pvShdArray = new pvShdArrayTracking(name);
					pvShdArray.x = x;
					pvShdArray.y = y;
					pvShdArray.z = z;
					pvShdArray.ySpacing = -1;
					this.SHDfile.ListeObjets.push(pvShdArray);
					newColumn = {index: this.SHDfile.ListeObjets.length-1, lastY: y};
					map.set(x, newColumn);
				} else {
					console.log('map has');
					curYSpacing = Math.abs(y-map.get(x).lastY);
					if(this.SHDfile.ListeObjets[map.get(x).index].ySpacing == -1) {
						console.log('setting ysapcing: ' + curYSpacing);
						this.SHDfile.ListeObjets[map.get(x).index].ySpacing = curYSpacing;
						this.SHDfile.ListeObjets[map.get(x).index].NElemChamps++;
						map.get(x).lastY = y;
					} else if (curYSpacing === this.SHDfile.ListeObjets[map.get(x).index].ySpacing) {
						console.log("adding champ");
						this.SHDfile.ListeObjets[map.get(x).index].NElemChamps++;
						map.get(x).lastY = y;
					} else {
						var pvShdArray = new pvShdArrayTracking(name);
						pvShdArray.x = x;
						pvShdArray.y = y;
						pvShdArray.z = z;
						pvShdArray.ySpacing = -1;
						this.SHDfile.ListeObjets.push(pvShdArray);
						newColumn = {index: this.SHDfile.ListeObjets.length-1, lastY: y};
						map.set(x, newColumn);
					}
				} */
				
			}
		}
		
		//find pannel block to get dimensions of pannel
		for(var i in this.jsonFile.blocks) {
			if(this.jsonFile.blocks[i].name.match("module")) {
				var j = 0;
				var length =0;
				var width = 0;
				while(length == 0 || width == 00) {
					if(length ==0) {
						length = this.jsonFile.blocks[i].entities[0].vertices[j].x;
					}
					if(width ==0) {
						width = this.jsonFile.blocks[i].entities[0].vertices[j].y;
					}
					j++;
				}
				for(var k in this.SHDfile.ListeObjets) {
					this.SHDfile.ListeObjets[k].LongShed = Math.abs(length*0.0254);
					this.SHDfile.ListeObjets[k].LargShed = Math.abs(width*0.0254);
				}
			}
			
		} 



		return this.SHDfile.print();
	}
}

class SHDfile {
	constructor() {
		this.Comment = "SHD file built from Helioscope dxf file";
		this.Version = "6.83";
		this.Flags = "$00";
		this.ListeObjets = new Array();
	}
	print() {
		var output = "PVObject_=pvShading\n";
		output += "Comment=" + this.Comment + "\n";
		output += "Version=" + this.Version + "\n";
		output += "Flags=" + this.Flags + "\n";
		output += "ListeObjets, list of=" + this.ListeObjets.length + " TShdObject\n";
		if(this.ListeObjets.length != 0) {
			for(var i in this.ListeObjets) {
				var count = parseInt(i) + 1;
				output += "PVObject_" + count + "=" + this.ListeObjets[i].print(count);
			}
		}
		output += "End of ListeObjets\n";
		output += "End of PVObject pvShading\n";
		return output;
	}
}

class PVObject {
	constructor(name) {
		this.name = name;
		this.Version = "6.83";
		this.Flags = "$02200000";
		this.NoObjCreated = null; 
		this.x = null;
		this.y = null;
		this.z = null;
		this.DInclin = "30.0";
	}
	print(count) {
		this.NoObjCreated = count;
		var output = this.name + "\n";
		output += "Version=" + this.Version + "\n";
		output += "Flags=" + this.Flags + "\n";
		output += "NoObjCreated=" + this.NoObjCreated + "\n";
		output += "DOrigine=" + this.x + "," + this.y + "," + this.z + "\n";
		output += "DInclin=" + this.DInclin + "\n";
		return output;
	}
} 

class pvShdArrayTracking extends PVObject {
	constructor(name) {
		super(name);
		this.NElemChamps = 1;
		this.xSpacing = 0;
		this.ySpacing = 0;
		this.pvCollPlane = new pvCollPlane();
		this.LargShed = null;
		this.LongShed = null;
		this.TypeOrigine = "7";
	}
	print(count) {
		var output = super.print(count);
		output += "NElemChamps=" + this.NElemChamps + "\n";
		output += "LongShed=" + this.LongShed + "\n";
		output += "LargShed=" + this.LargShed + "\n";
		output += "TypeOrigine=" + this.TypeOrigine + "\n";
		//output += "PitchNS=" + (this.ySpacing - this.LongShed) + "\n"; 
		output += this.pvCollPlane.print();
		output += "End of PVObject " + this.name + "\n";
		return output;
	} 
}

function pvCollPlane() {
	this.Flags = "$02200044";
	this.FieldType = "TrackVertAxis";
	this.InclMin = "30.0";
	this.InclMax = "30.0";
	this.AzimMin = "-120.0";
	this.AzimMax = "120.0";
	this.InclAxe = "30.0";
	this.AzimAxe= "0.0";
	this.print = function() {
		var output = "PVObject_PlanSuiv=pvCollPlane \n";
		output += "Flags=" + this.Flags + "\n";
		output += "FieldType=" + this.FieldType + "\n";
		output += "InclMin=" + this.InclMin + "\n";
		output += "InclMax=" + this.InclMax + "\n";
		output += "AzimMin=" + this.AzimMin + "\n";
		output += "AzimMax=" + this.AzimMax + "\n";
		output += "InclAxe=" + this.InclAxe + "\n";
		output += "AzimAxe=" + this.AzimAxe + "\n";
		output += "End of PVObject pvCollPlane \n";
		return output;
	}
}
