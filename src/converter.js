
function converter(json) {
	this.jsonFile = JSON.parse(json);
	this.SHDfile = new SHDfile();
	console.log(this.jsonFile);
	this.convert = function() {
        //convert the json file into shade tracking array objects
        var name = "pvShdArrayTracking";

        //map for tracking panels in the same column
        var map = new Map();

        //get positions of all modules
		for(var i in this.jsonFile.entities) {
            if (this.jsonFile.entities[i].layer == "Modules") {
                //the x y z coordinates of one panel
                var x = ((this.jsonFile.entities[i].position.x) * -0.0254);
				var y = ((this.jsonFile.entities[i].position.y) * -0.0254);
                var z = (this.jsonFile.entities[i].position.z * -0.0254);

                //need to round the x value for searching purposes because each panel differs slightly eventhough they are in the same 
                //column
                var searchX = x.toFixed(1);
                
                if (!map.has(searchX) || this.SHDfile.ListeObjets.length == 0) {
                    //if the column does not exist yet (no other panels are in that x position) or it is the first panel in the file,
                    //create a new shade tracking array object, set the coordinates, and add the panel to the list of objects in the 
                    //shd file
                    var pvShdArray = new pvShdArrayTracking(name);
                    pvShdArray.x = x;
					pvShdArray.y = y;
					pvShdArray.z = z;
                    this.SHDfile.ListeObjets.push(pvShdArray);

                    //add this column to the map so future pannels can add onto it that have the same x value
                    //columnPoints = [{ y: y, index: this.SHDfile.ListeObjets.length - 1 }];
                    newColumn = { index: this.SHDfile.ListeObjets.length - 1, bottomY: y, topY: y};
                    map.set(searchX, newColumn);
                } else {
                    //the map does have this x, therefore the column does exist...attempt to add panel to pre-existing column

                    //get the spacing between the bottom y value in the column and the current panel 
                    curYSpacing = Math.abs(y - map.get(searchX).bottomY);

                    if (this.SHDfile.ListeObjets[map.get(searchX).index].ySpacing == -1) {
                        //the spacing for this column has not been set yet, therefore, there is just one panel in the column
                        //set the spacing of this column to current spacing and add a panel 
                        this.SHDfile.ListeObjets[map.get(searchX).index].ySpacing = curYSpacing;
                        this.SHDfile.ListeObjets[map.get(searchX).index].NElemChamps++; //NElemChamps is the number of panels in a row
                        if (parseInt(this.SHDfile.ListeObjets[map.get(searchX).index].y) < y) {
                            //in PVSyst, columns are built from the lowest panel upwards, therefore, the y coordinate of the column
                            //must be the lowest y value
                            //(NOTE: PVSyst axes are switched, negatives are positives and positives are negatives)
                            this.SHDfile.ListeObjets[map.get(searchX).index].y = y;
                            map.get(searchX).bottomY = y;
                        } else {
                            map.get(searchX).topY = y;
                        }
                    } else if (curYSpacing.toFixed(1) == this.SHDfile.ListeObjets[map.get(searchX).index].ySpacing.toFixed(1)) { 
                        //the current spacing is the same as the spacing of the other panels in the column, therefore, the panel 
                        //belongs to this column, add the panel and set the lowest y value 
                        this.SHDfile.ListeObjets[map.get(searchX).index].NElemChamps++;
                        if (parseInt(this.SHDfile.ListeObjets[map.get(searchX).index].y) < y) {
                            this.SHDfile.ListeObjets[map.get(searchX).index].y = y;
                            map.get(searchX).bottomY = y;
                        } else {
                            map.get(searchX).topY = y;
                        }
                    } else { 
                        //has x in map but has different spacing, therefore, this panel marks the start of a new column on the x point
                        var pvShdArray = new pvShdArrayTracking(name);
                        pvShdArray.x = x;
                        pvShdArray.y = y;
						pvShdArray.z = z;
						this.SHDfile.ListeObjets.push(pvShdArray);
                        newColumn = { index: this.SHDfile.ListeObjets.length - 1, lastY: y };
                        map.set(searchX, newColumn);
					}
				} 			
			}
		}
		
		//find module "block" in dxf file to get dimensions of pannel
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
                //set the dimensions of the panels
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
		this.lowestY = null;
		this.ySpacing = -1;
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
        if (this.ySpacing != -1) {
            output += "PitchNS=" + this.ySpacing + "\n";
        }
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
