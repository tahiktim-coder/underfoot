// UNDERFOOT — the town, drawn by hand. One character per 2 m cell, 76 across (x from -80 to 72) and 67 down
// (z from -74 to 60); the camera looks toward the top left of this page, the giant comes in from the left,
// the river is below the bottom edge. town.js reads it: every house, lane, plaza, wall and cover in the game
// comes from this block, so edit it here. Rows are padded to 76 on the right as they are read.
//
// The legend (town.js LEGEND has the same list):
//   #  the town wall         T  a wall tower (on the wall)      G  a gate (two cells on the wall, one each)
//   .  a lane or street      Q  a plaza (open, paved: a dash)   :  yard paving (a courtyard)   =  stairs on a lane
//      (space) ground: a yard, a garden bed, nothing built
//   1 2 3  a house of one, two or three storeys: a rectangle of one glyph is one house
//   a b c  the same three, to put a house next to another of the same height without the two merging
//   S  a tall stone house (a tower house with a parapet: a landmark)
//   A  an arcade: a walk-under colonnade along a house front, open to the lane (always deep)
//   H  the market hall on posts (always deep)    m  a covered stall: a roof on four posts
//   C  the church nave   K  its tower (touching the nave)   P  its porch (in front of the tower, always deep)
//   k  a chapel          r  a ruin: walls, no roof, a doorway toward the lane
//   W  the well          Y  the big tree (its crown is cover)   t  a tree   g  a garden (bushes)
//   -  |  a low wall (a courtyard, a terrace, a garden); either glyph, the parser does not care which way
//
// Columns:  0         1         2         3         4         5         6         7
//           0123456789012345678901234567890123456789012345678901234567890123456789012345
export const TOWN_MAP = `

                            ####################
                         ####                  ##T#
                      ##T#          ..            ####
                    ###    t        .. 3333          ###t
                  ###        2222   .. 3333     2222   ###
                ###     111  2222111.. 3333 111 2222 111 ###
               ##    t  111  2222111.. 3333 111 2222 111  t##
             ###        111  2222111.. 3333 111 2222 111    ###
            ##            ......................              ##
           ##             ......................             ggg#
          ##              ..      ....      .... 111 2222    ggg##
         ##               ..2222  .. 3333111.... 111 2222    gggt##
        ##                ..2222  .. 3333111.... 111 2222         ##
       ##                 ..2222  .. 3333111..  ...........        ##
      #T     --------..   ..2222  .. 3333   ..  ...........         T#
      #      |::::::|..   ..      .. 3333   ..      3333 .. 111      #
     T#      |:SSSS:|....... bbbb ..        .. 2222 3333 .. 111      ##
     #     t |:SSSS::....... bbbb .. 2222111.. 2222 3333 .. 111       #
    ##       |:SSSS::..      bbbb .. 2222111.. 2222 3333 ..           ##
   ##    ggg |:SSSS:|..     tbbbb .. 2222111.. 2222 3333t.. 2222       ##
   #     ggg |::::::|..           .. 2222   ..           .. 2222        #
   #     ggg --------..      ...............      ......... 2222        #
  ##                 ..      ...............      ......... 2222        ##
  #                  ..........           ..CCCCCC..                     #
  #                  ..........           ..CCCCCC.. 2222         t      #
 ##         2222111    111 2222 111 2222  ..CCCCCC.. 2222  111           ##
 #          2222111    111 2222 111 222211..CCCCCC.. 2222  111            #
 #          2222111    111 2222 111 2222  ..CCCCCC.. 2222  111            #
 #      111 2222     2222           2222 t..CCCCCC..                      #
 #      111 QQQQQQQQQ2222111              ..CCCCCC..                      #
 #  2222111 QQQQQQQQQ2222111   2222    333..CCCCCC..2222                  #
 #  2222    QQQQQQQQQ2222111   2222 111333..CCCCCC..2222 111 2222     t   #
 #  2222  ..QQQQYQQQQ.......   2222 111333..CCCCCC..2222 111 2222         #
 #  2222  ..QQQQQQQQQ.......   2222 111333..CCCCCC..2222 111 2222         ##
 G..........QQQQQQQQQ     ..           333...KKKK............2222         #
 G..........QQQQQQQQQ2222 ..              ...KKKK............             #
 #  111     QQQQQQQQQ2222 ..              ...KKKK...     ..kkkk           #
 #  111 2222  .. 22222222 ...QmmQQQQHHHHHHQQ.KKKK...     ..kkkk 2222      #
 #  111 2222  .. 22222222 ...QmmQQQQHHHHHHQQQQPP....     ..kkkk 2222      #
 #      2222  .. 2222 111    QQQQQQQHHHHHHQQQQPP..bb3333 ..kkkk 2222111   #
 ##     2222  .. 2222 1113333QQQQQQQQQQQQQQQQQQQbbbb3333 ..kkkk 2222111  ##
  #  111      ..      1113333QQQQQQQQQQQQQQQQQQQbbbb3333 QQQQQQQQQ  111  #
  #  111 2222 .. bbbb aaa3333QQQQQQQWQQQQQQQQQQQbbbb3333 QQQQQQQQQ       #
  ## 111 2222 .. bbbb aaa3333QQQQQQQQQQQQQQQQQQQ.....===.QQQQQQQQQ......G#
   #     2222 .. bbbb aaa    QQQQQQQQQQQQQQQQQQQ.....===.QQQQQQQQQ......G
   #     2222 ...............QQQQQQQQQQQQQQQmmQQ..111    QQQQQQQQQ111   #
    #   t     ...............QQQQQQQQQQQQQQQmmQQ..111    QQQQQQQQQ111  ##
    ##               3333  ..  AAAAAAAAAA       ..111    QQQQQQQQQ111 ##
     #      2222 111 3333  ..  2222bbb3333      ..       111          #
     ##     2222 111 3333  ==  2222bbb3333     t.. 2222  111  rrrrr  ##
      #     2222 111 3333  ==  2222bbb33332222  .. 2222 t111  rrrrr  #
       #    2222ggg -------..--2222   33332222  .. 2222       rrrrr ##
       ##       ggg        ..........     2222  .. 2222       rrrrr##
        ##            111  ..........     2222  ..                ##
         ##       111 111  == 111   ..............  111          ##
          #T      111 111  == 111   ..............  111     t   ##
           ##     111      .. 111                   111        ##
            ##       ------..--------           111           T#
             ###               2222   111 2222  111  t      ###
               ##              2222ggg111 2222  111        ##
                ###            2222ggg111 2222t          ###
                  ###          2222ggg    2222         ###
                    ###                              ###
                      ####                        ####
                         ####                  ####
                            ########T###########
`;
