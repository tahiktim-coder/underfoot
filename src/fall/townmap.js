// UNDERFOOT — the town, drawn by hand. One character per 2 m cell, 76 across (x from -80 to 72) and 67 down
// (z from -74 to 60); the camera looks toward the top left of this page, the giant comes in from the left,
// the river is below the bottom edge. town.js reads it: every house, lane, plaza, wall and cover in the game
// comes from this block, so edit it here. Rows are padded to 76 on the right as they are read.
//
// The rules of the drawing (UNDERFOOT_NIGHT_DESIGN.md section 10 has the measurements):
//   - nothing walkable is narrower than two cells (4 m): the spine is six cells, the cross streets four or
//     five, the lanes three or four; a one-cell slot between two walls is never lit from anywhere
//   - cover stands in the open as islands (the hall, the stalls, the well, trees, carts, barrels, low walls,
//     the arcade along a front), never between two walls; the middle of every street is lit at some moment
//   - the church lane is low on its west side; the yard gaps are four cells wide with one-storey flanks
//   - the ground under the wall is scrub (h): not walkable, so nothing hides in the lee of the wall
//
// The legend (town.js LEGEND has the same list):
//   #  the town wall         T  a wall tower (on the wall)      G  a gate (two cells on the wall, one each)
//   .  a lane or street      Q  a plaza (open, paved: a dash)   :  yard paving (a courtyard)   =  stairs on a lane
//      (space) ground: a yard, a garden bed, nothing built
//   1 2 3  a house of one, two or three storeys: a rectangle of one glyph is one house
//   a b c  the same three, to put a house next to another of the same height without the two merging
//   S  a tall stone house (a tower house with a parapet: a landmark; one per quarter)
//   A  an arcade: a walk-under colonnade along a house front, open to the lane (always deep)
//   H  the market hall on posts (always deep)    m  a covered stall: a roof on four posts
//   C  the church nave   K  its tower (touching the nave)   P  its porch (in front of the tower, always deep)
//   k  a chapel          r  a ruin: walls, no roof, a doorway toward the lane
//   W  a well (the first by the square is the well)   Y  the big tree (its crown is cover)   t  a tree
//   g  a garden (bushes, walkable)   h  a hedge: scrub, bushes on every cell, not walkable
//   u  a cart, along the street it stands in   o  a stack of barrels
//   -  |  a low wall (a courtyard, a terrace, a garden); either glyph, the parser does not care which way
//
// Columns:  0         1         2         3         4         5         6         7
//           0123456789012345678901234567890123456789012345678901234567890123456789012345
export const TOWN_MAP = `

                            ####################
                         ####hhhhhhhhhhhhhhhhhh##T#
                      ##T#hhhhhhhhhhhhhhhhhhhhhhhh####
                    ###hhhhhhhhhhhhhhhhhhhhhhhhhhhhhh###
                  ###hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh###
                ###hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh###
               ##11112222bbbaaa333bbb2222aaa111333bbbaaa222##
             ###h11112222bbbaaa333bbb2222aaa111333bbbaaa222h###
            ##hhh11112222bbbaaa333bbb2222aaa111333bbbaaa222hhh##
           ##hQQQ..............u..........................QQQQQQ#
          ##hWQQQ.........................................QQQtQQ##
         ##tQQQQQ.........................................QQQQQQh##
        ##hQQQQQQ.....u........................u..........QQQQQQhh##
       ##1111aaaa....333bbbb222bbbaaaa....3333bbb2222.....2222SSSSh##
      #Th1111aaaa....333bbbb222bbbaaaa....3333bbb2222.....2222SSSShhT#
      #hh1111aaaa....333bbbb222bbbaaaa....3333bbb2222.....2222SSSShhh#
     T#2222bbb222....333bbbb222bbbaaaa....3333bbb2222.....2222SSSShhh##
     #h2222bbb222....2222aaa111aaa1111o...1111aaa1111.....bbb111bbb222#
    ##h2222bbb222....2222aaa111aaa1111....1111aaa1111u....bbb111bbb222##
   ##QQQQQQQQQQQQ....2222aaa111aaa1111....1111aaa1111.....bbb111bbb222h##
   #hQQQQQQQtQQQQ.........................................bbb111bbb222hh#
   #hQQQQQQoQQQQQ....................................................hhh#
  ##hQQQQQQQQQQuQ....................................................hhh##
  #hhQQQQQQQQ---Q....................................................hhhh#
  #hhQQQQQQQQQQQQ...o2222bbb2222bbb111....gggCCCCCChh................hhhh#
 ##hhSSSSQQQQQQQQ....2222bbb2222bbb111....gggCCCCCChh.....2222bbb222bbbhh##
 #hhhSSSSQQQQQQQQ....2222bbb2222bbb111....gtgCCCCCChh.....2222bbb222bbbhhh#
 #hhhSSSSQQQQQQQQ....2222bbb2222bbb111....gggCCCCCChh.....2222bbb222bbbhhh#
 #hhhSSSSQQQQQQQQ....hhhhhhhhhhhhhhhhh...ugggCCCCCChh.....hhkkkkk111aaahhh#
 #h2222bbbbQQQQQQ....3333cccc333ccc111....gggCCCCCChh....ohhkkkkk111aaahhh#
 #h2222bbbbQQQQQQ....3333cccc333ccc111....gtgCCCCCChh.....hhkkkkk111aaahhh#
 #h2222bbbbQQQQQQ....3333cccc333ccc111....gggCCCCCChh.....QQQQQQQQQQ222hhh#
 #h2222bbbboQQQQQ....3333cccc333ccc111....gggCCCCCChh.....QQQQQQQQQQ222hhh#
 #..o....u..............QQQQQQQQQuQQQQQQQQQQQQKKKKQQQ.....QQQQQQQQQQ222hhh##
 G......................QHHHHHHQQQQQQQQQQmmQQQKKKKQQQ.....QQQQQQQQQQ222hhh#
 G......Y...............QHHHHHHQQQQQQQQQQmmQQQKKKKQQQ.....QQQQtQQQQQ222hhh#
 #......................QHHHHHHQQQQQQQQQQQQQQQQPPQQQQ....uQQQQQQQQQQbbbhhh#
 #......................QQQQQQQQQQQQQQQQQQQQQQQPPQQQQ.....QQQQQQQQQQbbbhhh#
 #....u.................QQQQQQQQQQQQQQQQQQQQQQQQQQQQQ.....QQQQQQQQQQbbbhhh#
 #hhh111aaa111ggg....222QQQQQQQQQQQQQQQQQQQQQQQQQQQtQ.....QQQQQQQQQQbbbhhh#
 ##hh111aaa111ggg....222QQQtQQQQQQQQQQQQQQQQQQQQQQQQQ.....QQQQQQQQQQbbbhh##
  #hh111aaa111ggg....222QQQQQQQQQQQQQQQQQQQQQQQQQQQQQ.....o..............#
  #hh------------====222QQQQQQQQQQQQQQWQQQQQQQQQQQQQQ....................#
  ##hgggggggggggg....bbbQmmQQQQQQQQQQQQQQQQQQQQQQQQQQ...................G#
   #hggggggtggggg....bbbQmmQQQQQtQQQQQQQQQQQQQQQQQQQQ...................G
   #hgggggggggggg....bbbQQQQQQQQQQQQQQQQQQQQQuQQQQoQQ.........u...o.....#
    #h-----------====bbbAAAAAAAAAAAA....SSSS222bbb222.....rrrrr22222hhh##
    ##hh111aaa111....111bbbb2222bbbb....SSSS222bbb222.....rrrrr22222hh##
     #hh111aaa111....111bbbb2222bbbb....SSSS222bbb222.....rrrrr22222hh#
     ##h111aaa111...o111bbbb2222bbbb....SSSS222bbb222.....rrrrr22222h##
      #hhhhhhh..................................u...........o......hh#
       #hhhhhh.....................................................h##
       ##hhhhh.....................................................##
        ##hhhh....................................................##
         ##hhh1112222bbbaaa1111222bbb333aaa1111222bbbaaa111222hhh##
          #Thh1112222bbbaaa1111222bbb333aaa1111222bbbaaa111222hh##
           ##h1112222bbbaaa1111222bbb333aaa1111222bbbaaa111222h##
            ##hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhT#
             ###hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh###
               ##hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh##
                ###hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh###
                  ###hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh###
                    ###hhhhhhhhhhhhhhhhhhhhhhhhhhhhhh###
                      ####hhhhhhhhhhhhhhhhhhhhhhhh####
                         ####hhhhhhhhhhhhhhhhhh####
                            ########T###########
`;
