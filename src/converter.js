//Takes a json verision of the dxf file
function converter(json) {
	this.jsonFile = JSON.parse(json);
    this.SHDfile = new SHDfile();
    console.log(this.jsonFile);
	this.convert = function() {
        //convert the json file into shade tracking array objects
        var length = 0;
        var width = 0;
        var height = 0;
        
        //find module "block" in dxf file to get dimensions of pannel
        for (var i in this.jsonFile.blocks) {
            if (this.jsonFile.blocks[i].name.match("module")) {
                var j = 0;
                while ((length == 0 || width == 0 || height == 0) && j < 4) {
                    if (length == 0) {
                        length = this.jsonFile.blocks[i].entities[0].vertices[j].x;
                    }
                    if (width == 0) {
                        width = this.jsonFile.blocks[i].entities[0].vertices[j].y;
                    }
                    if (height == 0) {
                        height = this.jsonFile.blocks[i].entities[0].vertices[j].z;
                    }
                    j++;
                }
            }

        }
        //correct width of panel due to dxf file birds eye view of a tilted panel
        //(find distance of the width of the panel based on the tilt)
        width = Math.sqrt(Math.pow(width, 2) + Math.pow(height, 2));

        //create maps to hold columns of panels
        //purpose: limit the size of the output file by grouping panels
        var NSColumns = new Map();
        var skewedColumns = new Map();

        //find the dimensions of each panel and add them to the appropriate column in the maps
        for (var i in this.jsonFile.entities) {
            if (this.jsonFile.entities[i].layer == "Modules") {
                //x y coordinates of each panel and angle of rotation 
                var x = this.jsonFile.entities[i].position.x;
                var y = this.jsonFile.entities[i].position.y;
                var rotation = this.jsonFile.entities[i].rotation;

                //if the panel has an angle of rotation, find the slope of the panel and add it to the skewed columns map 
                //based on it's b value (y = mx + b)
                if (rotation != 0) {
                    var slope = 0;
                    //convert to radians
                    rotation = rotation * (Math.PI / 180);
                    if ((rotation > 0 && rotation < (Math.PI / 2)) || (rotation < (-3 / 2) * Math.PI && rotation > -2 * Math.PI)) {
                        //first quadrant
                        slope = -1 / Math.tan(rotation);
                    } else if ((rotation > Math.PI / 2 && rotation < Math.PI) || (rotation < -1 * Math.PI && rotation > (-3 / 2) * Math.PI)) {
                        //second quadrant
                        slope = Math.tan(rotation);
                    } else if ((rotation > Math.PI && rotation < (3 / 2) * Math.PI) || (rotation <  Math.PI/-2 && rotation > -1 * Math.PI)) {
                        //third quadrant
                        slope = -1 / Math.tan(rotation);
                    } else if ((rotation > (3 / 2) * Math.PI && rotation < 2 * Math.PI) || (rotation < 0 && rotation > Math.PI/-2)) {
                        //fourth quadrant
                        slope = Math.tan(rotation);
                    } else {
                        //the rotation is 90 or 180 degrees
                        //this layout is not skewed so run a N/S map
                        rotation = 0;
                    }
                    var B = Math.trunc(y - (slope * x));
                    //if the skewed column map has the calculated B value, a column for this panel already exists
                    //otherwise, create a new column with a new B value
                    if (skewedColumns.has(B)) {
                        skewedColumns.get(B).push({ "x": (x*-0.0254), "y": (y*-0.0254) });
                    } else {
                        var points = new Array();
                        points.push({ "x": (x * -0.0254), "y": (y * -0.0254) });
                        skewedColumns.set(B, points);
                    }
                }

                //if the rotation angle = 0, then the drawing is perfectly N/S
                //(creating columns is much easier...find groups of panels based on x value)
                if (rotation == 0) {
                    //convert inches of dxf file to meters of pvsyst file
                    x = x * -0.0254;
                    y = y * -0.0254;
                    var searchX = x.toFixed();
                    //if the column already exists based on the x value, add it to the column
                    //otherwise create a new column based on the x value
                    if (NSColumns.has(searchX)) {
                        var newCoordinate = { "x": x, "y": y };
                        NSColumns.get(searchX).push(newCoordinate);
                        //each x value is slightly different in the dxf file, this if statement is finding 
                        //the leftmost x value of each column (NOTE: pvsyst axises have switched signs)
                        if (NSColumns.get(searchX).x < x) {
                            NSColumns.get(searchX).x = x;
                        }
                    } else {
                        var coordinates = new Array();
                        var newCoordinate = { "x": x, "y": y };
                        coordinates.push(newCoordinate);
                        NSColumns.set(searchX, coordinates);
                    }
                }

            }
        }

        //build the SHD file objects
        var ListeObjetsNS = buildField(NSColumns, length, width);
        var ListeObjetsSkewed = buildField(skewedColumns, length, width);
        this.SHDfile.ListeObjets = ListeObjetsNS.concat(ListeObjetsSkewed);

        //Print the SHD file in correct PVSyst format
		return this.SHDfile.print();
	}
}

function buildField(map, length, width) {
    var ListeObjets = new Array();
    //for each column, create a PVSyst object 
    for (var coordinates of map.values()) {
        //sort the y values lowest to highest in order to easily identify keepout areas
        //and PVSyst builds the columns from south most point up
        coordinates.sort(function (a, b) { return b.y - a.y });
        console.log(coordinates);
        var ySpacing = -1;
        var xSpacing = -1;
        var curIndex = 0;
        //for each point in the column, identify the spacing between the current and the pervious panel to insure the
        //same spacing (NOTE: each column in PVSyst can only have one spacing value, it does not account for keepout areas)
        for (var i in coordinates) {
            if (ySpacing == -1) {
                //THIS IS SPECIFIC TO PVBOOSTER
                var pvShdArray = new pvShdArrayTracking("pvShdArrayTracking");
                //set x and y coordinates of the start of the column and the width and length of the panel
                //add the panel to the list of objects in the SHD file
                pvShdArray.x = coordinates[i].x;
                pvShdArray.y = coordinates[i].y;
                pvShdArray.LongShed = Math.abs(length * 0.0254);
                pvShdArray.LargShed = Math.abs(width * 0.0254);
                ListeObjets.push(pvShdArray);
                //hold the index of this column in the list of obejects in order to add more panels in the future
                curIndex = ListeObjets.length - 1;
                ySpacing = -2;
            } else {
                //get the current spacing between panels
                var currYSpacing = Math.abs(coordinates[i].y - coordinates[i - 1].y);
                var currXSpacing = Math.abs(coordinates[i].x - coordinates[i - 1].x);
                if (ySpacing == -2) {
                    //set the spacing of the column 
                    //(at this point, the column should only have two panels in it, therefore, these two panels define the spacing)
                    ListeObjets[curIndex].ySpacing = currYSpacing.toFixed(2);
                    ListeObjets[curIndex].xSpacing = currXSpacing.toFixed(2);
                    ySpacing = currYSpacing
                    xSpacing = currXSpacing;
                    //add the panel to the column
                    //(NOTE: NElemChamps is the count of panels in each column in PVSyst)
                    ListeObjets[curIndex].NElemChamps++;
                } else if (currYSpacing.toFixed() == ySpacing.toFixed() && currXSpacing.toFixed() == xSpacing.toFixed()) {
                    //the spacing is the same as the columns spacing, therefore the panel belongs to this column
                    //add the panel to the column
                    ListeObjets[curIndex].NElemChamps++;
                } else {
                    //the panel belongs to this column but has a different spacing, therefore, this panel is the start of a new
                    //column. Set x and y coordinates and length and width of panel
                    var pvShdArray = new pvShdArrayTracking("pvShdArrayTracking");
                    pvShdArray.x = coordinates[i].x;
                    pvShdArray.y = coordinates[i].y;
                    pvShdArray.LongShed = Math.abs(length * 0.0254);
                    pvShdArray.LargShed = Math.abs(width * 0.0254);
                    ySpacing = -2;
                    //add the new column as a new PVSyst object and hold the new index of the most recent PVSyst Object
                    ListeObjets.push(pvShdArray);
                    curIndex = ListeObjets.length - 1;
                }

            }
        }
    }
    return ListeObjets;
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
        this.z = "0.0";
        //THIS IS SPECIFIC TO PVBOOSTER
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
        this.xSpacing = -1;
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
        if (this.xSpacing != -1) {
            output += "PitchEW=" + this.xSpacing + "\n";
        }
		output += this.pvCollPlane.print();
		output += "End of PVObject " + this.name + "\n";
		return output;
	} 
}

function pvCollPlane() {
    this.Flags = "$02200044";
    //THIS IS SPECIFIC TO PVBOOSTER
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
