#!/usr/bin/perl

use strict;
use warnings;

use Test::More;
use Plack::Debugger;
use Plack::Debugger::Storage;
use Plack::App::Debugger;

my $debugger = Plack::Debugger->new(
    storage => Plack::Debugger::Storage->new(
        data_dir     => $DATA_DIR,
        serializer   => sub { $JSON->encode( shift ) },
        deserializer => sub { $JSON->decode( shift ) },
        filename_fmt => $Plack::Test::Debugger::ResultGenerator::FILENAME_FMT,
    )
);

my $debugger_app = Plack::App::Debugger->new( debugger => $debugger );

is($debugger_app->is_enabled(), 1, 'The debugger is enabled by default');

$debugger_app->disable();

is($debugger_app->is_enabled(), 0, 'The debugger is new disabled');

done_testing;
