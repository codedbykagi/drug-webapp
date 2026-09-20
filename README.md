DRUG WEBAPP - HOW TO USE
 
What this tool is: it documents a presumptive colorimetric drug test. It
photographs the reagent test before and after the reaction, measures the
color under a known lighting reference, compares it against a registry of
reagent reference colors, and files a record with GPS and timestamp.
 
What it is not: it does not identify substances. Reagent color tests are
presumptive and have real false-positive rates. Laboratory confirmation is
always required.
 
 
------------------------------------------------------------------------
BEFORE YOU START
------------------------------------------------------------------------
 
Use Chrome or Safari on a phone, or a laptop with a webcam. The camera and
GPS only work over HTTPS, so use the deployed link, not a plain http://
address on a local network - that will make both fail silently or use the
current available site (https://drug-webapp-nu.vercel.app/)
 
 
------------------------------------------------------------------------
STEP 1 - LOAD THE REAGENT REGISTRY (DO THIS FIRST)
------------------------------------------------------------------------
 
The app ships with NO reference colors loaded. This is deliberate -
reference colors are evidence, and inventing them would let a reading be
"matched" against a number nobody measured. Until you import the registry,
the result panel will say no registry is loaded and nothing will match.
 
  1. Go into the  registry/  folder in this repository and open
     drugtrace-registry.json
 
  2. Download it (use the download / raw button, then save the file).
 
  3. In the webapp, open "Reagents & Registry" in the left sidebar.
 
  4. Choose Import, select the drugtrace-registry.json file you saved,
     and confirm.
 
  5. The screen should now show 23 reagents and 65 reference colors.
 
On a phone the sidebar is hidden - use the menu control at the top left to
reach "Reagents & Registry".
 
 
------------------------------------------------------------------------
STEP 2 - PRINT THE REFERENCE CARD
------------------------------------------------------------------------
 
The card is what makes the reading repeatable. The same pouch photographed
under tungsten light, daylight and an LED gives three different RGB values;
a surface of known reflectance in the frame lets the app measure the light
instead of guessing it.
 
  1. Open  [public/reference-card.html](https://drug-webapp-nu.vercel.app/reference-card.html)  from this repository in a browser
     and print it. It is 88 mm wide.
 
  2. Print on MATTE paper at 100% scale. Turn any printer color correction
     off. Glossy stock reflects light into the lens, and color management
     changes the patch values.
 
  3. Plain white paper will also work as a neutral surface if you have no
     card to hand - it is less accurate but far better than nothing.
 
Place the printed card on the surface and put the reagent test directly
BELOW it, so both the card and the test sit inside the same photo frame
under the same light.
 
 
------------------------------------------------------------------------
STEP 3 - TAKE THE "BEFORE" PHOTO
------------------------------------------------------------------------
 
  1. Open "Field Test & Intake" in the sidebar. The capture panel opens on
     the "Before" slot.
 
  2. Press "Take a picture" and allow camera access when the browser asks.
     ("Upload image" is there if you photographed the test on another
     device and want to bring the file in instead.)
 
  3. Frame the shot so the reference card and the untouched sample are both
     visible, then capture.
 
  4. Tap the neutral grey patch on the card in the photo. This is the light
     reference. If the app rejects the tap it will say why - the patch was
     in shadow, blown out, or you tapped the pouch by mistake. Re-tap or
     re-shoot.
 
  5. Tap the sample area itself to place the reading point.
 
Do not change the lighting, the distance or the phone between the two
photos. The app locks exposure and white balance where the browser allows
it, but not every browser exposes that control, which is exactly why the
card in frame is not optional.
 
 
------------------------------------------------------------------------
STEP 4 - ADD THE REAGENT AND TAKE THE "AFTER" PHOTO
------------------------------------------------------------------------
 
  1. Apply the reagent to the sample and let it react.
 
  2. The app moves to the "After" slot on its own once the before frame is
     captured. Press "Take a picture" again, in the same position and the
     same light.
 
  3. Tap the reference patch and the reaction area in this photo too.
 
Two photos, not one, because comparing before against after is what tells
you whether the reagent did anything at all. If the difference is too small,
the result is negative no matter what the absolute color looks like.
 
 
------------------------------------------------------------------------
STEP 5 - RECORD THE LOCATION
------------------------------------------------------------------------
 
Press "Tap to record location" in the top bar and allow location access.
The fix starts on the first photo, so by the time you save it is usually
already locked. The coordinates and their accuracy are stored with the
record.
 
 
------------------------------------------------------------------------
STEP 6 - FILL IN THE TEST DETAILS
------------------------------------------------------------------------
 
Under "Test details & officer information", enter:
 
  - Officer name, badge or service number
  - Designation, station or unit
  - Reason for the test and the suspected substance
  - Reagent used - leave it as "Not specified" to compare against every
    reagent in the registry
  - Any notes that affect how the reading should be read later
 
The result panel on the right updates live. It lists what is still missing
before a record can be filed, and it shows the measured color, the color
difference and a plain-language match quality - never a confidence
percentage, because a color distance is not a probability.
 
 
------------------------------------------------------------------------
STEP 7 - FILE THE RECORD
------------------------------------------------------------------------
 
Press "File case record".
 
The record is written to the device (IndexedDB) and works with no signal.
Each record is hashed over its metadata AND the raw bytes of both photos,
and the previous record's hash is folded into the next one. Change a single
pixel of an old photo and every hash after it stops matching.
 
If the app warns that no lighting reference was marked, go back and tap the
card. A record without it says so rather than pretending it was corrected.
 
Filed records appear in the case log below the capture panel, where the
chain can be re-verified at any time.
 
 
------------------------------------------------------------------------
STEP 8 - PRINT OR SAVE THE CUSTODY DOCUMENT
------------------------------------------------------------------------
 
Press "Preview custody report", then print. Choose "Save as PDF" in the
print dialogue if you want a file rather than paper.
 
Keep "background graphics" enabled in the print options, otherwise the
color swatches are stripped out. The report carries both photographs with
their measured values, the officer details, the location and the hash.
 
 
------------------------------------------------------------------------
ASKING THE REGISTRY (RAG)
------------------------------------------------------------------------
 
"Ask the registry" in the sidebar (or the floating button on a phone)
answers questions from the registry data - how to test for a substance,
what a reagent does, what turns a given color, what is expired, what is
loaded.
 
It is retrieval over your own data: no API key, no
network. It answers in under a millisecond in airplane mode, and it cannot
invent a color nobody measured. If it does not know, it says so and lists
what it does have.
 
 
------------------------------------------------------------------------
IF SOMETHING DOES NOT WORK
------------------------------------------------------------------------
 
Camera button does nothing
  The page is not on HTTPS, or camera permission was denied. Use the
  https:// link and check the browser's site permissions.
 
Location never resolves
  Same cause - HTTPS and permissions. Indoors a fix can take a while.
 
Nothing matches, everything reads "no registry loaded"
  The registry was never imported. Go back to Step 1.
 
Every result comes out negative
  The before and after colors are too close to each other. Check the
  reagent actually reacted, and that both photos were taken in the same
  light.
 
The reference patch is rejected
  The card was in shadow or blown out by a highlight. Move out of direct
  glare and re-shoot.
 
