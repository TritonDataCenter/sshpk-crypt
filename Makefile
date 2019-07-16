#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
#

#
# Copyright 2019 Joyent, Inc.
#

#
# Tools
#
TAPE :=			./node_modules/.bin/tape

#
# Makefile.defs defines variables used as part of the build process.
# Ensure we have the eng submodule before attempting to include it.
#
ENGBLD_REQUIRE          := $(shell git submodule update --init deps/eng)
include ./deps/eng/tools/mk/Makefile.defs
TOP ?= $(error Unable to access eng.git submodule Makefiles.)

#
# Configuration used by Makefile.defs and Makefile.targ to generate
# "check" and "docs" targets.
#
BASH_FILES =		tools/check-copyright
DOC_FILES =		
JSON_FILES =		package.json
JS_FILES :=		$(shell find lib test -name '*.js') tools/bashstyle
JSL_FILES_NODE =	$(JS_FILES)
JSSTYLE_FILES =		$(JS_FILES)

JSL_CONF_NODE =		tools/jsl.node.conf
JSSTYLE_FLAGS =		-f tools/jsstyle.conf

#
# Historically, Node packages that make use of binary add-ons must ship their
# own Node built with the same compiler, compiler options, and Node version that
# the add-on was built with.  On SmartOS systems, we use prebuilt Node images
# via Makefile.node_prebuilt.defs.  On other systems, we build our own Node
# binary as part of the build process.  Other options are possible -- it depends
# on the need of your repository.
#
NODE_PREBUILT_VERSION =	v6.17.0
ifeq ($(shell uname -s),SunOS)
	NODE_PREBUILT_TAG = zone64
	include ./deps/eng/tools/mk/Makefile.node_prebuilt.defs
else
	NPM=npm
	NODE=node
	NPM_EXEC=$(shell which npm)
	NODE_EXEC=$(shell which node)
endif


#
# Makefile.node_modules.defs provides a common target for installing modules
# with NPM from a dependency specification in a "package.json" file.  By
# including this Makefile, we can depend on $(STAMP_NODE_MODULES) to drive "npm
# install" correctly.
#
include ./deps/eng/tools/mk/Makefile.node_modules.defs

#
# Repo-specific targets
#
.PHONY: all
all: $(SMF_MANIFESTS) $(STAMP_NODE_MODULES) $(GO_TARGETS) | $(REPO_DEPS)

#
# If a project produces a SmartOS image for use in Manta/Triton, a release
# target should construct the RELEASE_TARBALL file
#
.PHONY: release
release:
	echo "Do work here"
#
# This example Makefile defines a special target for building manual pages.  You
# may want to make these dependencies part of "all" instead.
#
.PHONY: manpages
manpages: $(MAN_OUTPUTS)

.PHONY: test
test: $(STAMP_NODE_MODULES) $(GO_TEST_TARGETS) $(TEST_CTF_TARGETS)
	$(NODE) $(TAPE) test/*.test.js

#
# Target definitions.  This is where we include the target Makefiles for
# the "defs" Makefiles we included above.
#

include ./deps/eng/tools/mk/Makefile.deps

ifeq ($(shell uname -s),SunOS)
	include ./deps/eng/tools/mk/Makefile.node_prebuilt.targ
endif

include ./deps/eng/tools/mk/Makefile.node_modules.targ
include ./deps/eng/tools/mk/Makefile.targ
